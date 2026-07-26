package com.picore.booking;

import com.picore.booking.dto.BookingResponse;
import com.picore.clazz.ClassSession;
import com.picore.clazz.ClassSessionRepository;
import com.picore.clazz.GymClass;
import com.picore.clazz.GymClassRepository;
import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.me.dto.MyBookingItem;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.memberpackage.MemberPackage;
import com.picore.memberpackage.MemberPackageRepository;
import com.picore.notification.NotificationService;
import com.picore.trainer.TrainerProfile;
import com.picore.trainer.TrainerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Service đặt & hủy lịch tập (UC5.1).
 * Dùng khóa bi quan trên class_session để tránh race condition khi nhiều hội viên đặt cùng lúc.
 */
@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);

    private static final List<Booking.BookingStatus> OCCUPYING =
            List.of(Booking.BookingStatus.BOOKED, Booking.BookingStatus.ATTENDED);

    private final MemberRepository memberRepository;
    private final ClassSessionRepository classSessionRepository;
    private final BookingRepository bookingRepository;
    private final MemberPackageRepository memberPackageRepository;
    private final WaitlistRepository waitlistRepository;
    private final GymClassRepository gymClassRepository;
    private final TrainerRepository trainerRepository;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;

    public BookingService(MemberRepository memberRepository,
                          ClassSessionRepository classSessionRepository,
                          BookingRepository bookingRepository,
                          MemberPackageRepository memberPackageRepository,
                          WaitlistRepository waitlistRepository,
                          GymClassRepository gymClassRepository,
                          TrainerRepository trainerRepository,
                          NotificationService notificationService,
                          AuditLogService auditLogService) {
        this.memberRepository = memberRepository;
        this.classSessionRepository = classSessionRepository;
        this.bookingRepository = bookingRepository;
        this.memberPackageRepository = memberPackageRepository;
        this.waitlistRepository = waitlistRepository;
        this.gymClassRepository = gymClassRepository;
        this.trainerRepository = trainerRepository;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
    }

    /**
     * Đặt lịch cho một buổi tập.
     *
     * @param userId          userId của người đặt (MEMBER tự đặt) — dùng để tra Member
     * @param classSessionId  buổi tập cần đặt
     * @param memberPackageId gói tập dùng để trừ buổi
     */
    @Transactional
    public BookingResponse bookSession(Long userId, Long classSessionId, Long memberPackageId) {
        Member member = requireMemberByUser(userId);
        return doBook(member, classSessionId, memberPackageId);
    }

    /**
     * Đặt hộ cho một hội viên (RECEPTIONIST) — xác định Member trực tiếp theo memberId.
     */
    @Transactional
    public BookingResponse bookSessionForMember(Long memberId, Long classSessionId, Long memberPackageId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy hội viên"));
        return doBook(member, classSessionId, memberPackageId);
    }

    private BookingResponse doBook(Member member, Long classSessionId, Long memberPackageId) {
        Long memberId = member.getId();

        // a. Khóa buổi tập để nối tiếp việc kiểm tra sức chứa.
        ClassSession session = classSessionRepository.findByIdForUpdate(classSessionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy buổi tập"));

        // a'. Khóa đặt chỗ 30 phút trước giờ bắt đầu.
        LocalDateTime sessionStart = session.getSessionDate().atTime(session.getStartTime());
        if (!LocalDateTime.now().isBefore(sessionStart.minusMinutes(30))) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Lớp học đã khóa đặt chỗ. Vui lòng đặt trước ít nhất 30 phút.");
        }

        // b. Kiểm tra sức chứa.
        int booked = bookingRepository.countByClassSessionIdAndStatusIn(classSessionId, OCCUPYING);
        if (booked >= session.getCapacity()) {
            throw new ApiException(HttpStatus.CONFLICT, "Lớp học đã đầy");
        }

        // c. Kiểm tra gói tập.
        MemberPackage pkg = requireUsablePackage(member, memberPackageId);

        // d. Chống đặt trùng.
        if (bookingRepository.existsByClassSessionIdAndMemberIdAndStatusIn(classSessionId, memberId, OCCUPYING)) {
            throw new ApiException(HttpStatus.CONFLICT, "Bạn đã đặt lịch cho buổi học này");
        }

        // e. Tạo booking.
        Booking booking = new Booking();
        booking.setClassSessionId(classSessionId);
        booking.setMemberId(memberId);
        booking.setMemberPackageId(pkg.getId());
        booking.setStatus(Booking.BookingStatus.BOOKED);
        booking.setBookedAt(LocalDateTime.now());

        // f. Trừ buổi (chỉ với gói giới hạn số buổi).
        if (pkg.getSessionsRemaining() != null) {
            pkg.setSessionsRemaining(pkg.getSessionsRemaining() - 1);
            memberPackageRepository.save(pkg);
        }

        // g. Lưu booking.
        Booking saved = bookingRepository.save(booking);
        auditLogService.log(memberId, "CREATE_BOOKING", "booking", saved.getId(),
                "Đặt lịch sessionId=" + classSessionId);

        // Thông báo (không để lỗi thông báo làm hỏng giao dịch).
        notifyQuietly(() -> notificationService.sendBookingConfirmation(memberId, saved.getId()));

        return toResponse(saved);
    }

    /**
     * Hủy một lịch đã đặt. Chỉ hủy được lịch còn ở trạng thái BOOKED.
     */
    @Transactional
    public void cancelBooking(Long userId, Long bookingId) {
        Member member = requireMemberByUser(userId);
        cancelInternal(member.getId(), bookingId, true);
    }

    /**
     * Hủy lịch dưới quyền RECEPTIONIST — không ràng buộc ownership theo user hiện tại.
     */
    @Transactional
    public void cancelBookingAsStaff(Long bookingId) {
        cancelInternal(null, bookingId, false);
    }

    private void cancelInternal(Long ownerMemberId, Long bookingId, boolean verifyOwnership) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lịch đặt"));

        if (verifyOwnership && !booking.getMemberId().equals(ownerMemberId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền hủy lịch này");
        }

        if (booking.getStatus() != Booking.BookingStatus.BOOKED) {
            throw new ApiException(HttpStatus.CONFLICT, "Chỉ có thể hủy lịch chưa diễn ra");
        }

        // Không cho hủy buổi đã qua ngày (bảo vệ API khỏi gọi trực tiếp)
        classSessionRepository.findById(booking.getClassSessionId()).ifPresent(session -> {
            if (session.getSessionDate().isBefore(LocalDate.now())) {
                throw new ApiException(HttpStatus.CONFLICT, "Không thể hủy lịch của buổi học đã diễn ra");
            }
        });

        booking.setStatus(Booking.BookingStatus.CANCELLED);
        booking.setCancelledAt(LocalDateTime.now());

        // Hoàn buổi cho gói giới hạn.
        if (booking.getMemberPackageId() != null) {
            memberPackageRepository.findById(booking.getMemberPackageId()).ifPresent(pkg -> {
                if (pkg.getSessionsRemaining() != null) {
                    pkg.setSessionsRemaining(pkg.getSessionsRemaining() + 1);
                    memberPackageRepository.save(pkg);
                }
            });
        }

        bookingRepository.save(booking);
        auditLogService.log(booking.getMemberId(), "CANCEL_BOOKING", "booking", bookingId,
                "Hủy lịch bookingId=" + bookingId);

        // UC5.2 — buổi private (1-1/1-2) không nằm trong timetable cố định: nếu hủy hết chỗ
        // thì xóa buổi orphan (chỉ với buổi chưa diễn ra), tránh chiếm khung giờ HLV.
        long remaining = bookingRepository.countByClassSessionIdAndStatusIn(
                booking.getClassSessionId(),
                List.of(Booking.BookingStatus.BOOKED, Booking.BookingStatus.ATTENDED));
        if (remaining == 0) {
            classSessionRepository.findById(booking.getClassSessionId()).ifPresent(cs -> {
                if (cs.getType() != ClassSession.SessionType.GROUP
                        && !cs.getSessionDate().isBefore(LocalDate.now())) {
                    classSessionRepository.delete(cs);
                }
            });
        }

        // Thông báo cho người đầu danh sách chờ (FIFO).
        notifyWaitlistHead(booking.getClassSessionId());
    }

    private void notifyWaitlistHead(Long classSessionId) {
        waitlistRepository.findFirstByClassSessionIdAndNotifiedFalseOrderByCreatedAtAsc(classSessionId)
                .ifPresent(entry -> {
                    entry.setNotified(true);
                    waitlistRepository.save(entry);
                    notifyQuietly(() ->
                            notificationService.sendWaitlistInvite(entry.getMemberId(), classSessionId));
                });
    }

    /**
     * Tham gia danh sách chờ khi lớp đã đầy chỗ.
     */
    @Transactional
    public void joinWaitlist(Long userId, Long classSessionId) {
        Member member = requireMemberByUser(userId);
        Long memberId = member.getId();

        ClassSession session = classSessionRepository.findById(classSessionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy buổi tập"));

        int booked = bookingRepository.countByClassSessionIdAndStatusIn(classSessionId, OCCUPYING);
        if (booked < session.getCapacity()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Lớp vẫn còn chỗ, vui lòng đặt lịch trực tiếp");
        }

        if (waitlistRepository.existsByClassSessionIdAndMemberId(classSessionId, memberId)) {
            throw new ApiException(HttpStatus.CONFLICT, "Bạn đã có trong danh sách chờ của buổi này");
        }

        Waitlist entry = new Waitlist();
        entry.setClassSessionId(classSessionId);
        entry.setMemberId(memberId);
        entry.setNotified(false);
        waitlistRepository.save(entry);
    }

    /**
     * Danh sách lịch tập của hội viên theo bộ lọc UPCOMING / COMPLETED / CANCELLED.
     */
    @Transactional(readOnly = true)
    public List<MyBookingItem> getMyBookings(Long userId, String status) {
        Member member = requireMemberByUser(userId);
        LocalDate today = LocalDate.now();
        String filter = status == null ? "UPCOMING" : status.trim().toUpperCase();

        List<Booking.BookingStatus> statuses = switch (filter) {
            case "UPCOMING" -> List.of(Booking.BookingStatus.BOOKED);
            case "COMPLETED" -> List.of(Booking.BookingStatus.ATTENDED);
            case "CANCELLED" -> List.of(Booking.BookingStatus.CANCELLED);
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "status",
                    "Bộ lọc không hợp lệ. Chỉ nhận UPCOMING, COMPLETED hoặc CANCELLED.");
        };

        List<Booking> bookings = bookingRepository
                .findByMemberIdAndStatusInOrderByBookedAtDesc(member.getId(), statuses);
        if (bookings.isEmpty()) {
            return List.of();
        }

        // Batch-load ClassSession, tên lớp, tên HLV (tránh N+1) — theo pattern của MeService.
        Map<Long, ClassSession> sessions = classSessionRepository
                .findAllById(bookings.stream().map(Booking::getClassSessionId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(ClassSession::getId, Function.identity()));

        List<Long> gymClassIds = sessions.values().stream()
                .map(ClassSession::getGymClassId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        Map<Long, String> gymClassNames = gymClassRepository.findAllById(gymClassIds).stream()
                .collect(Collectors.toMap(GymClass::getId, GymClass::getName));

        List<Long> trainerIds = sessions.values().stream()
                .map(ClassSession::getTrainerId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        Map<Long, String> trainerNames = trainerRepository.findAllById(trainerIds).stream()
                .filter(tp -> tp.getUserAccount() != null)
                .collect(Collectors.toMap(TrainerProfile::getId,
                        tp -> tp.getUserAccount().getFullName()));

        List<MyBookingItem> items = bookings.stream()
                .map(b -> toBookingItem(b, sessions.get(b.getClassSessionId()), gymClassNames, trainerNames))
                .filter(item -> item != null)
                .filter(item -> !"UPCOMING".equals(filter) || !item.sessionDate().isBefore(today))
                .collect(Collectors.toList());

        // Sắp xếp theo yêu cầu từng bộ lọc.
        switch (filter) {
            case "UPCOMING" -> items.sort(Comparator
                    .comparing(MyBookingItem::sessionDate)
                    .thenComparing(MyBookingItem::startTime));
            case "COMPLETED" -> items.sort(Comparator
                    .comparing(MyBookingItem::sessionDate).reversed());
            case "CANCELLED" -> items.sort(Comparator
                    .comparing(MyBookingItem::cancelledAt,
                            Comparator.nullsLast(Comparator.naturalOrder())).reversed());
            default -> { }
        }

        return items;
    }

    // ---- Helpers ----

    private MemberPackage requireUsablePackage(Member member, Long memberPackageId) {
        LocalDate today = LocalDate.now();
        MemberPackage pkg = memberPackageId == null ? null
                : memberPackageRepository.findById(memberPackageId).orElse(null);

        boolean usable = pkg != null
                && pkg.getMember() != null
                && member.getId().equals(pkg.getMember().getId())
                && pkg.getStatus() == MemberPackage.MemberPackageStatus.ACTIVE
                && pkg.getEndDate() != null && !pkg.getEndDate().isBefore(today)
                && (pkg.getSessionsRemaining() == null || pkg.getSessionsRemaining() > 0);

        if (!usable) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "memberPackageId",
                    "Bạn chưa có gói tập còn hiệu lực");
        }
        return pkg;
    }

    private MyBookingItem toBookingItem(Booking b, ClassSession cs,
                                        Map<Long, String> gymClassNames,
                                        Map<Long, String> trainerNames) {
        if (cs == null) {
            return null;
        }
        String className = resolveClassName(cs, gymClassNames);
        String trainerName = cs.getTrainerId() != null ? trainerNames.get(cs.getTrainerId()) : null;
        return new MyBookingItem(
                b.getId(),
                className,
                trainerName,
                cs.getSessionDate(),
                cs.getStartTime(),
                cs.getEndTime(),
                b.getStatus().name(),
                b.getBookedAt(),
                b.getCancelledAt());
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

    private BookingResponse toResponse(Booking b) {
        return new BookingResponse(b.getId(), b.getClassSessionId(), b.getStatus().name(), b.getBookedAt());
    }

    private Member requireMemberByUser(Long userId) {
        return memberRepository.findByUserAccountId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Không tìm thấy hồ sơ hội viên cho tài khoản này"));
    }

    private void notifyQuietly(Runnable action) {
        try {
            action.run();
        } catch (RuntimeException ex) {
            log.warn("Gửi thông báo thất bại (bỏ qua): {}", ex.getMessage());
        }
    }
}
