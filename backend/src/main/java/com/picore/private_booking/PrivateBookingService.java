package com.picore.private_booking;

import com.picore.booking.Booking;
import com.picore.booking.BookingRepository;
import com.picore.clazz.ClassSession;
import com.picore.clazz.ClassSessionRepository;
import com.picore.common.exception.ApiException;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.memberpackage.MemberPackage;
import com.picore.memberpackage.MemberPackageRepository;
import com.picore.notification.NotificationService;
import com.picore.packageplan.PackageType;
import com.picore.private_booking.dto.CreatePrivateBookingRequest;
import com.picore.private_booking.dto.PrivateSlotsResponse;
import com.picore.booking.dto.BookingResponse;
import com.picore.trainer.TrainerProfile;
import com.picore.trainer.TrainerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;

/**
 * UC5.2 — Đăng ký buổi tập 1-1 / 1-2.
 *
 * <p>Tách riêng khỏi {@link com.picore.booking.BookingService} (đặt lớp nhóm UC5.1). Service này
 * tự tạo {@link ClassSession} cho buổi private (không có sẵn timetable), kiểm tra xung đột lịch HLV,
 * xử lý ghép cặp cho gói 1-2 và quản lý deadline đăng ký theo tuần.</p>
 */
@Service
public class PrivateBookingService {

    private static final Logger log = LoggerFactory.getLogger(PrivateBookingService.class);

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private static final List<Booking.BookingStatus> OCCUPYING =
            List.of(Booking.BookingStatus.BOOKED, Booking.BookingStatus.ATTENDED);

    private static final List<PackageType.PackageCategory> PRIVATE_CATEGORIES =
            List.of(PackageType.PackageCategory.GOI_1_1, PackageType.PackageCategory.GOI_1_2);

    // Các khung giờ có thể đăng ký: ca sáng 06:00–12:00, ca chiều 13:00–19:00, bước 1 giờ.
    private static final LocalTime[] SLOT_STARTS = {
            LocalTime.of(6, 0), LocalTime.of(7, 0), LocalTime.of(8, 0), LocalTime.of(9, 0),
            LocalTime.of(10, 0), LocalTime.of(11, 0),
            LocalTime.of(13, 0), LocalTime.of(14, 0), LocalTime.of(15, 0), LocalTime.of(16, 0),
            LocalTime.of(17, 0), LocalTime.of(18, 0)
    };

    private final MemberRepository memberRepository;
    private final ClassSessionRepository classSessionRepository;
    private final BookingRepository bookingRepository;
    private final MemberPackageRepository memberPackageRepository;
    private final TrainerRepository trainerRepository;
    private final NotificationService notificationService;

    public PrivateBookingService(MemberRepository memberRepository,
                                 ClassSessionRepository classSessionRepository,
                                 BookingRepository bookingRepository,
                                 MemberPackageRepository memberPackageRepository,
                                 TrainerRepository trainerRepository,
                                 NotificationService notificationService) {
        this.memberRepository = memberRepository;
        this.classSessionRepository = classSessionRepository;
        this.bookingRepository = bookingRepository;
        this.memberPackageRepository = memberPackageRepository;
        this.trainerRepository = trainerRepository;
        this.notificationService = notificationService;
    }

    // ---- GET /private-booking/slots ----

    @Transactional(readOnly = true)
    public PrivateSlotsResponse getSlots(Long userId, String week) {
        Member member = requireMemberByUser(userId);

        LocalDateTime now = LocalDateTime.now();
        boolean deadlinePassed = isDeadlinePassed(now);

        // Tuần mục tiêu: mặc định theo deadline, frontend có thể override bằng param `week`.
        LocalDate weekStart;
        String targetWeek;
        if (week != null && !week.isBlank()) {
            weekStart = parseWeekToMonday(week);
            targetWeek = week.trim();
        } else {
            weekStart = earliestBookableMonday(now);
            targetWeek = formatWeek(weekStart);
        }
        LocalDate weekEnd = weekStart.plusDays(6);

        // E-2: chưa có gói 1-1/1-2 còn hiệu lực → trả grid rỗng (frontend xử lý thông báo).
        if (!hasActivePrivatePackage(member.getId())) {
            return new PrivateSlotsResponse(targetWeek, false, List.of());
        }

        // W2-fix: hội viên GOI_1_2 cần thấy slot có thể ghép (PRIVATE_1_2 chưa đủ 2 người).
        boolean isGoi12Member = hasActiveGoi12Package(member.getId());

        List<TrainerProfile> trainers =
                trainerRepository.findAllByStatusOrderByIdAsc(TrainerProfile.TrainerStatus.ACTIVE);

        List<PrivateSlotsResponse.SlotEntry> slots = new ArrayList<>();
        for (TrainerProfile trainer : trainers) {
            String trainerName = trainer.getUserAccount() != null
                    ? trainer.getUserAccount().getFullName() : "HLV";
            for (LocalDate date = weekStart; !date.isAfter(weekEnd); date = date.plusDays(1)) {
                String dow = date.getDayOfWeek().name().substring(0, 3); // MON, TUE, ...
                for (LocalTime start : SLOT_STARTS) {
                    LocalTime end = start.plusHours(1);
                    List<ClassSession> conflicting = classSessionRepository
                            .findConflictingSessions(trainer.getId(), date, date, start, end);
                    boolean available;
                    if (conflicting.isEmpty()) {
                        available = true;
                    } else if (isGoi12Member) {
                        // Slot joinable nếu có buổi PRIVATE_1_2 chưa đủ 2 người (matchmaking).
                        available = conflicting.stream().anyMatch(cs ->
                                cs.getType() == ClassSession.SessionType.PRIVATE_1_2
                                && bookingRepository.countByClassSessionIdAndStatusIn(
                                        cs.getId(), OCCUPYING) < cs.getCapacity());
                    } else {
                        available = false;
                    }
                    slots.add(new PrivateSlotsResponse.SlotEntry(
                            trainer.getId(), trainerName,
                            date.format(DATE_FMT), dow,
                            start.format(TIME_FMT), end.format(TIME_FMT),
                            available));
                }
            }
        }
        return new PrivateSlotsResponse(targetWeek, deadlinePassed, slots);
    }

    // ---- POST /private-booking ----

    @Transactional
    public BookingResponse createPrivateBooking(Long userId, CreatePrivateBookingRequest req) {
        if (req == null || req.trainerId() == null || req.date() == null
                || req.startTime() == null || req.memberPackageId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Thiếu thông tin đăng ký (HLV, ngày, giờ hoặc gói tập)");
        }

        Member member = requireMemberByUser(userId);

        // 2. Kiểm tra gói tập.
        MemberPackage pkg = requirePrivatePackage(member, req.memberPackageId());
        PackageType.PackageCategory category = pkg.getPackageType().getCategory();

        // 4. Parse ngày & giờ.
        LocalDate date = parseDate(req.date());
        LocalTime startTime = parseTime(req.startTime());
        LocalTime endTime = startTime.plusHours(1);

        // 3. Kiểm tra deadline: buổi phải nằm trong tuần được phép đăng ký.
        LocalDate earliestMonday = earliestBookableMonday(LocalDateTime.now());
        if (mondayOf(date).isBefore(earliestMonday)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Đã hết hạn đăng ký cho tuần này");
        }

        Long trainerId = req.trainerId();
        ClassSession.SessionType type = category == PackageType.PackageCategory.GOI_1_1
                ? ClassSession.SessionType.PRIVATE_1_1
                : ClassSession.SessionType.PRIVATE_1_2;

        ClassSession session;

        if (type == ClassSession.SessionType.PRIVATE_1_2) {
            // c. Ghép cặp cho gói 1-2: ưu tiên ghép vào buổi đang chờ người.
            ClassSession joinable = findJoinable12Session(trainerId, date, startTime, member.getId());
            if (joinable != null) {
                session = joinable; // Ghép vào buổi hiện có, dùng chung khung giờ HLV.
            } else {
                requireNoConflict(trainerId, date, startTime, endTime);
                session = createSession(trainerId, date, startTime, endTime,
                        ClassSession.SessionType.PRIVATE_1_2, 2);
                // Mời hội viên cụ thể → tạo luôn booking thứ 2 cho partner.
                if (req.partnerMemberId() != null
                        && (req.joinMatchmaking() == null || !req.joinMatchmaking())) {
                    createPartnerBooking(session, req.partnerMemberId(), member.getId());
                }
                // joinMatchmaking / không lựa chọn → để buổi chờ ghép sau (capacity=2, 1 booking).
            }
        } else {
            // 1-1: luôn tạo buổi mới sức chứa 1.
            requireNoConflict(trainerId, date, startTime, endTime);
            session = createSession(trainerId, date, startTime, endTime,
                    ClassSession.SessionType.PRIVATE_1_1, 1);
        }

        // Chống đặt trùng chính mình vào cùng buổi.
        if (bookingRepository.existsByClassSessionIdAndMemberIdAndStatusIn(
                session.getId(), member.getId(), OCCUPYING)) {
            throw new ApiException(HttpStatus.CONFLICT, "Bạn đã đăng ký buổi tập này");
        }

        // d. Tạo booking cho hội viên.
        Booking booking = new Booking();
        booking.setClassSessionId(session.getId());
        booking.setMemberId(member.getId());
        booking.setMemberPackageId(pkg.getId());
        booking.setStatus(Booking.BookingStatus.BOOKED);
        booking.setBookedAt(LocalDateTime.now());

        // e. Trừ buổi (gói giới hạn số buổi).
        if (pkg.getSessionsRemaining() != null) {
            pkg.setSessionsRemaining(pkg.getSessionsRemaining() - 1);
            memberPackageRepository.save(pkg);
        }

        Booking saved = bookingRepository.save(booking);

        // 6. Thông báo (không để lỗi thông báo làm hỏng giao dịch).
        final Long memberId = member.getId();
        notifyQuietly(() -> notificationService.sendBookingConfirmation(memberId, saved.getId()));
        notifyTrainer(trainerId, date, startTime);

        return new BookingResponse(saved.getId(), saved.getClassSessionId(),
                saved.getStatus().name(), saved.getBookedAt());
    }

    // ---- Helpers: ghép cặp & tạo buổi ----

    /** Tìm buổi 1-2 cùng khung giờ còn chỗ (bookedCount < 2) mà hội viên chưa tham gia. */
    private ClassSession findJoinable12Session(Long trainerId, LocalDate date,
                                               LocalTime startTime, Long memberId) {
        List<ClassSession> candidates =
                classSessionRepository.findPrivate12Sessions(trainerId, date, startTime);
        for (ClassSession cs : candidates) {
            int booked = bookingRepository.countByClassSessionIdAndStatusIn(cs.getId(), OCCUPYING);
            boolean alreadyIn = bookingRepository.existsByClassSessionIdAndMemberIdAndStatusIn(
                    cs.getId(), memberId, OCCUPYING);
            if (booked < 2 && !alreadyIn) {
                return cs;
            }
        }
        return null;
    }

    private ClassSession createSession(Long trainerId, LocalDate date, LocalTime start,
                                       LocalTime end, ClassSession.SessionType type, int capacity) {
        ClassSession cs = new ClassSession();
        cs.setTrainerId(trainerId);
        cs.setSessionDate(date);
        cs.setStartTime(start);
        cs.setEndTime(end);
        cs.setType(type);
        cs.setCapacity(capacity);
        try {
            return classSessionRepository.save(cs);
        } catch (DataIntegrityViolationException ex) {
            // W1-fix: unique constraint uq_class_session_trainer_slot bắt race condition.
            throw new ApiException(HttpStatus.CONFLICT,
                    "Khung giờ này vừa được đặt bởi người khác. Vui lòng chọn khung giờ khác.");
        }
    }

    private void createPartnerBooking(ClassSession session, Long partnerMemberId, Long selfMemberId) {
        if (partnerMemberId.equals(selfMemberId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "partnerMemberId",
                    "Không thể mời chính mình vào buổi 1-2");
        }
        Member partner = memberRepository.findById(partnerMemberId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "partnerMemberId",
                        "Không tìm thấy hội viên được mời"));
        Booking partnerBooking = new Booking();
        partnerBooking.setClassSessionId(session.getId());
        partnerBooking.setMemberId(partner.getId());
        partnerBooking.setMemberPackageId(null); // partner tự dùng gói riêng khi điểm danh/đối soát
        partnerBooking.setStatus(Booking.BookingStatus.BOOKED);
        partnerBooking.setBookedAt(LocalDateTime.now());
        bookingRepository.save(partnerBooking);
    }

    private void requireNoConflict(Long trainerId, LocalDate date, LocalTime start, LocalTime end) {
        boolean conflict = !classSessionRepository
                .findConflictingSessions(trainerId, date, date, start, end).isEmpty();
        if (conflict) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Khung giờ này vừa được đặt bởi người khác. Vui lòng chọn khung giờ khác.");
        }
    }

    // ---- Helpers: gói tập ----

    private boolean hasActivePrivatePackage(Long memberId) {
        LocalDate today = LocalDate.now();
        return memberPackageRepository.findByMemberIdOrderByStartDateDescIdDesc(memberId).stream()
                .anyMatch(p -> p.getStatus() == MemberPackage.MemberPackageStatus.ACTIVE
                        && p.getEndDate() != null && !p.getEndDate().isBefore(today)
                        && p.getPackageType() != null
                        && PRIVATE_CATEGORIES.contains(p.getPackageType().getCategory()));
    }

    /** W2-fix: kiểm tra hội viên có gói GOI_1_2 ACTIVE không (để cho phép matchmaking). */
    private boolean hasActiveGoi12Package(Long memberId) {
        LocalDate today = LocalDate.now();
        return memberPackageRepository.findByMemberIdOrderByStartDateDescIdDesc(memberId).stream()
                .anyMatch(p -> p.getStatus() == MemberPackage.MemberPackageStatus.ACTIVE
                        && p.getEndDate() != null && !p.getEndDate().isBefore(today)
                        && p.getPackageType() != null
                        && p.getPackageType().getCategory() == PackageType.PackageCategory.GOI_1_2
                        && (p.getSessionsRemaining() == null || p.getSessionsRemaining() > 0));
    }

    private MemberPackage requirePrivatePackage(Member member, Long memberPackageId) {
        LocalDate today = LocalDate.now();
        MemberPackage pkg = memberPackageRepository.findById(memberPackageId).orElse(null);

        boolean usable = pkg != null
                && pkg.getMember() != null
                && member.getId().equals(pkg.getMember().getId())
                && pkg.getStatus() == MemberPackage.MemberPackageStatus.ACTIVE
                && pkg.getEndDate() != null && !pkg.getEndDate().isBefore(today)
                && (pkg.getSessionsRemaining() == null || pkg.getSessionsRemaining() > 0)
                && pkg.getPackageType() != null
                && PRIVATE_CATEGORIES.contains(pkg.getPackageType().getCategory());

        if (!usable) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "memberPackageId",
                    "Bạn chưa có gói 1-1/1-2 còn hiệu lực");
        }
        return pkg;
    }

    // ---- Helpers: tuần & deadline ----

    /** Chủ Nhật 23:59 của tuần hiện tại đã trôi qua chưa (hạn chốt cho tuần kế). */
    private boolean isDeadlinePassed(LocalDateTime now) {
        LocalDate sunday = now.toLocalDate().with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        LocalDateTime deadline = LocalDateTime.of(sunday, LocalTime.of(23, 59));
        return now.isAfter(deadline);
    }

    /** Thứ Hai của tuần sớm nhất được phép đăng ký: tuần kế, hoặc kế +1 nếu đã quá hạn. */
    private LocalDate earliestBookableMonday(LocalDateTime now) {
        LocalDate thisMonday = now.toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return isDeadlinePassed(now) ? thisMonday.plusDays(14) : thisMonday.plusDays(7);
    }

    private LocalDate mondayOf(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private String formatWeek(LocalDate monday) {
        WeekFields wf = WeekFields.ISO;
        int weekYear = monday.get(wf.weekBasedYear());
        int week = monday.get(wf.weekOfWeekBasedYear());
        return String.format("%04d-W%02d", weekYear, week);
    }

    /** Parse "YYYY-Www" → thứ Hai của tuần ISO đó. */
    private LocalDate parseWeekToMonday(String week) {
        try {
            String[] parts = week.trim().split("-W");
            int year = Integer.parseInt(parts[0]);
            int wk = Integer.parseInt(parts[1]);
            return LocalDate.of(year, 1, 4) // ngày 4/1 luôn thuộc tuần ISO 1
                    .with(WeekFields.ISO.weekOfWeekBasedYear(), wk)
                    .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        } catch (RuntimeException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "week",
                    "Tuần không hợp lệ (định dạng đúng: YYYY-Www)");
        }
    }

    private LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value, DATE_FMT);
        } catch (RuntimeException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "date", "Ngày không hợp lệ");
        }
    }

    private LocalTime parseTime(String value) {
        try {
            return LocalTime.parse(value, TIME_FMT);
        } catch (RuntimeException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "startTime", "Giờ không hợp lệ");
        }
    }

    // ---- Helpers khác ----

    private void notifyTrainer(Long trainerId, LocalDate date, LocalTime startTime) {
        trainerRepository.findById(trainerId).ifPresent(trainer -> {
            Long trainerUserId = trainer.getUserAccount() != null
                    ? trainer.getUserAccount().getId() : null;
            log.info("[UC5.2] Thông báo HLV userId={} có buổi private mới ngày {} lúc {}",
                    trainerUserId, date, startTime);
        });
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
