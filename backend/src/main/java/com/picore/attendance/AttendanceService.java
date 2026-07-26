package com.picore.attendance;

import com.picore.attendance.dto.AttendeeItem;
import com.picore.attendance.dto.CheckInResponse;
import com.picore.attendance.dto.QuickCheckinResponse;
import com.picore.attendance.dto.SessionSummary;
import com.picore.booking.Booking;
import com.picore.booking.BookingRepository;
import com.picore.clazz.ClassSession;
import com.picore.clazz.ClassSessionRepository;
import com.picore.clazz.GymClass;
import com.picore.clazz.GymClassRepository;
import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.memberpackage.MemberPackage;
import com.picore.memberpackage.MemberPackageRepository;
import com.picore.trainer.TrainerProfile;
import com.picore.trainer.TrainerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Service điểm danh buổi học (UC5.3) — dành cho RECEPTIONIST.
 * Gồm: danh sách buổi hôm nay, danh sách hội viên/buổi, check-in "Có mặt" / "No-show",
 * và điểm danh nhanh (walk-in) theo SĐT.
 */
@Service
public class AttendanceService {

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    // Các trạng thái "đã chiếm chỗ" (tính vào bookedCount / danh sách hội viên) — bỏ CANCELLED.
    private static final List<Booking.BookingStatus> ACTIVE_STATUSES = List.of(
            Booking.BookingStatus.BOOKED,
            Booking.BookingStatus.ATTENDED,
            Booking.BookingStatus.NO_SHOW);

    private final ClassSessionRepository classSessionRepository;
    private final BookingRepository bookingRepository;
    private final MemberRepository memberRepository;
    private final MemberPackageRepository memberPackageRepository;
    private final GymClassRepository gymClassRepository;
    private final TrainerRepository trainerRepository;
    private final AuditLogService auditLogService;

    public AttendanceService(ClassSessionRepository classSessionRepository,
                             BookingRepository bookingRepository,
                             MemberRepository memberRepository,
                             MemberPackageRepository memberPackageRepository,
                             GymClassRepository gymClassRepository,
                             TrainerRepository trainerRepository,
                             AuditLogService auditLogService) {
        this.classSessionRepository = classSessionRepository;
        this.bookingRepository = bookingRepository;
        this.memberRepository = memberRepository;
        this.memberPackageRepository = memberPackageRepository;
        this.gymClassRepository = gymClassRepository;
        this.trainerRepository = trainerRepository;
        this.auditLogService = auditLogService;
    }

    /**
     * Danh sách buổi học hôm nay + counter điểm danh (batch-load để tránh N+1).
     */
    @Transactional(readOnly = true)
    public List<SessionSummary> getTodaySessions() {
        List<ClassSession> sessions =
                classSessionRepository.findBySessionDateOrderByStartTimeAsc(LocalDate.now());
        if (sessions.isEmpty()) {
            return List.of();
        }

        List<Long> sessionIds = sessions.stream().map(ClassSession::getId).toList();

        // Batch-load các booking chiếm chỗ của tất cả buổi trong ngày, gom nhóm theo sessionId.
        Map<Long, List<Booking>> bookingsBySession = bookingRepository
                .findByClassSessionIdInAndStatusIn(sessionIds, ACTIVE_STATUSES).stream()
                .collect(Collectors.groupingBy(Booking::getClassSessionId));

        // Batch-load tên lớp nhóm + tên HLV.
        Map<Long, String> gymClassNames = gymClassRepository.findAllById(
                        sessions.stream()
                                .map(ClassSession::getGymClassId)
                                .filter(id -> id != null)
                                .distinct()
                                .toList()).stream()
                .collect(Collectors.toMap(GymClass::getId, GymClass::getName));

        Map<Long, String> trainerNames = trainerRepository.findAllById(
                        sessions.stream()
                                .map(ClassSession::getTrainerId)
                                .filter(id -> id != null)
                                .distinct()
                                .toList()).stream()
                .filter(tp -> tp.getUserAccount() != null)
                .collect(Collectors.toMap(TrainerProfile::getId,
                        tp -> tp.getUserAccount().getFullName()));

        return sessions.stream().map(cs -> {
            List<Booking> bookings = bookingsBySession.getOrDefault(cs.getId(), List.of());
            int bookedCount = bookings.size();
            int checkedInCount = (int) bookings.stream()
                    .filter(b -> b.getStatus() == Booking.BookingStatus.ATTENDED)
                    .count();
            String trainerName = cs.getTrainerId() != null ? trainerNames.get(cs.getTrainerId()) : null;
            return new SessionSummary(
                    cs.getId(),
                    resolveClassName(cs, gymClassNames),
                    trainerName,
                    cs.getStartTime().format(HHMM),
                    cs.getEndTime().format(HHMM),
                    cs.getCapacity(),
                    bookedCount,
                    checkedInCount);
        }).toList();
    }

    /**
     * Danh sách hội viên đã đặt buổi {sessionId} (bỏ CANCELLED). Sort: BOOKED trước, đã xử lý sau.
     */
    @Transactional(readOnly = true)
    public List<AttendeeItem> getAttendees(Long sessionId) {
        // Xác nhận buổi tồn tại (404 rõ ràng thay vì trả list rỗng khi id sai).
        classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy buổi học"));

        List<Booking> bookings =
                bookingRepository.findByClassSessionIdAndStatusIn(sessionId, ACTIVE_STATUSES);
        if (bookings.isEmpty()) {
            return List.of();
        }

        // Batch-load tên hội viên.
        Map<Long, String> memberNames = memberRepository.findAllById(
                        bookings.stream().map(Booking::getMemberId).distinct().toList()).stream()
                .collect(Collectors.toMap(Member::getId, Member::getFullName));

        // Batch-load thông tin gói (tên loại gói + số buổi còn) theo memberPackageId.
        Map<Long, MemberPackage> packages = memberPackageRepository.findAllById(
                        bookings.stream()
                                .map(Booking::getMemberPackageId)
                                .filter(id -> id != null)
                                .distinct()
                                .toList()).stream()
                .collect(Collectors.toMap(MemberPackage::getId, Function.identity()));

        return bookings.stream().map(b -> {
            MemberPackage pkg = b.getMemberPackageId() != null
                    ? packages.get(b.getMemberPackageId()) : null;
            String packageTypeName = (pkg != null && pkg.getPackageType() != null)
                    ? pkg.getPackageType().getName() : null;
            Integer sessionsRemaining = pkg != null ? pkg.getSessionsRemaining() : null;
            return new AttendeeItem(
                    b.getId(),
                    b.getMemberId(),
                    memberNames.getOrDefault(b.getMemberId(), "Hội viên"),
                    packageTypeName,
                    sessionsRemaining,
                    b.getStatus().name());
        }).sorted(Comparator.comparingInt(this::statusSortKey)).toList();
    }

    /**
     * Điểm danh "Có mặt": chuyển BOOKED → ATTENDED, ghi checked_in_at.
     * Không trừ buổi (đã trừ khi đặt lịch UC5.1).
     */
    @Transactional
    public CheckInResponse checkIn(Long bookingId) {
        Booking booking = requireBookedBooking(bookingId);
        booking.setStatus(Booking.BookingStatus.ATTENDED);
        booking.setCheckedInAt(LocalDateTime.now());
        Booking saved = bookingRepository.save(booking);
        auditLogService.log(0L, "CHECK_IN", "booking", bookingId, "Check-in bookingId=" + bookingId);
        return new CheckInResponse(saved.getId(), saved.getStatus().name(), saved.getCheckedInAt());
    }

    /**
     * Điểm danh "No-show": chuyển BOOKED → NO_SHOW. Không hoàn buổi (BR 5.2).
     */
    @Transactional
    public CheckInResponse markNoShow(Long bookingId) {
        Booking booking = requireBookedBooking(bookingId);
        booking.setStatus(Booking.BookingStatus.NO_SHOW);
        Booking saved = bookingRepository.save(booking);
        auditLogService.log(0L, "MARK_NO_SHOW", "booking", bookingId, "No-show bookingId=" + bookingId);
        return new CheckInResponse(saved.getId(), saved.getStatus().name(), saved.getCheckedInAt());
    }

    /**
     * Điểm danh nhanh (walk-in): tìm hội viên theo SĐT, lấy gói ACTIVE còn hiệu lực,
     * trừ 1 buổi (nếu gói giới hạn) và tạo booking ATTENDED không gắn buổi cụ thể.
     */
    @Transactional
    public QuickCheckinResponse quickCheckin(String phone) {
        if (phone == null || phone.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "phone", "Vui lòng nhập số điện thoại");
        }

        Member member = memberRepository.findByPhone(phone.trim())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Không tìm thấy hội viên với SĐT này"));

        MemberPackage pkg = findUsableActivePackage(member.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Hội viên chưa có gói tập còn hiệu lực"));

        // Trừ 1 buổi với gói giới hạn (walk-in chưa từng đặt lịch nên chưa bị trừ).
        if (pkg.getSessionsRemaining() != null) {
            pkg.setSessionsRemaining(pkg.getSessionsRemaining() - 1);
            memberPackageRepository.save(pkg);
        }

        // Tạo booking walk-in: không gắn class_session (classSessionId = null).
        Booking booking = new Booking();
        booking.setClassSessionId(null);
        booking.setMemberId(member.getId());
        booking.setMemberPackageId(pkg.getId());
        booking.setStatus(Booking.BookingStatus.ATTENDED);
        booking.setBookedAt(LocalDateTime.now());
        booking.setCheckedInAt(LocalDateTime.now());
        bookingRepository.save(booking);
        auditLogService.log(0L, "QUICK_CHECKIN", "member", member.getId(),
                "Walk-in: " + member.getPhone());

        String packageTypeName = pkg.getPackageType() != null ? pkg.getPackageType().getName() : null;
        return new QuickCheckinResponse(member.getFullName(), packageTypeName, pkg.getSessionsRemaining());
    }

    // ---- Helpers ----

    private Booking requireBookedBooking(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lịch đặt"));
        if (booking.getStatus() != Booking.BookingStatus.BOOKED) {
            throw new ApiException(HttpStatus.CONFLICT, "Hội viên này đã được xử lý điểm danh");
        }
        return booking;
    }

    /**
     * Chọn gói ACTIVE còn hiệu lực (endDate >= today; sessionsRemaining null hoặc > 0),
     * ưu tiên gói mới nhất theo start_date.
     */
    private java.util.Optional<MemberPackage> findUsableActivePackage(Long memberId) {
        LocalDate today = LocalDate.now();
        return memberPackageRepository.findByMemberIdOrderByStartDateDescIdDesc(memberId).stream()
                .filter(p -> p.getStatus() == MemberPackage.MemberPackageStatus.ACTIVE)
                .filter(p -> p.getEndDate() != null && !p.getEndDate().isBefore(today))
                .filter(p -> p.getSessionsRemaining() == null || p.getSessionsRemaining() > 0)
                .findFirst();
    }

    // BOOKED (chưa xử lý) lên đầu; ATTENDED/NO_SHOW xuống dưới.
    private int statusSortKey(AttendeeItem item) {
        return "BOOKED".equals(item.bookingStatus()) ? 0 : 1;
    }

    private String resolveClassName(ClassSession cs, Map<Long, String> gymClassNames) {
        if (cs.getGymClassId() != null) {
            return gymClassNames.getOrDefault(cs.getGymClassId(), "Lớp tập");
        }
        return switch (cs.getType()) {
            case PRIVATE_1_1 -> "Buổi 1-1";
            case PRIVATE_1_2 -> "Buổi 1-2";
            default -> "Buổi tập";
        };
    }
}
