package com.picore.trainer;

import com.picore.booking.Booking;
import com.picore.booking.BookingRepository;
import com.picore.clazz.ClassSession;
import com.picore.clazz.ClassSessionRepository;
import com.picore.clazz.GymClass;
import com.picore.clazz.GymClassRepository;
import com.picore.common.exception.ApiException;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.trainer.dto.SessionAttendeesResponse;
import com.picore.trainer.dto.TrainerScheduleResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * UC4.4 — Lịch dạy của HLV. HLV đang đăng nhập xem các buổi (GROUP + PRIVATE) của
 * chính mình trong 1 tuần. trainerId luôn suy ra từ userId (SecurityContext), không nhận từ param.
 */
@Service
public class TrainerScheduleService {

    private static final WeekFields ISO = WeekFields.ISO;
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private static final List<Booking.BookingStatus> OCCUPYING =
            List.of(Booking.BookingStatus.BOOKED, Booking.BookingStatus.ATTENDED);

    private final ClassSessionRepository classSessionRepository;
    private final BookingRepository bookingRepository;
    private final GymClassRepository gymClassRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;

    public TrainerScheduleService(ClassSessionRepository classSessionRepository,
                                  BookingRepository bookingRepository,
                                  GymClassRepository gymClassRepository,
                                  MemberRepository memberRepository,
                                  TrainerRepository trainerRepository) {
        this.classSessionRepository = classSessionRepository;
        this.bookingRepository = bookingRepository;
        this.gymClassRepository = gymClassRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
    }

    @Transactional(readOnly = true)
    public TrainerScheduleResponse getSchedule(Long userId, String week) {
        // 1. Hồ sơ HLV từ userId đăng nhập.
        TrainerProfile trainer = trainerRepository.findByUserAccountId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ HLV"));
        String trainerName = trainer.getUserAccount() != null
                ? trainer.getUserAccount().getFullName() : "HLV";

        // 2. Parse tuần → monday..sunday.
        LocalDate monday = parseWeekToMonday(week);
        LocalDate sunday = monday.plusDays(6);
        String weekStr = formatWeek(monday);

        // 3. Query buổi của HLV trong tuần.
        List<ClassSession> sessions = classSessionRepository
                .findByTrainerIdAndSessionDateBetweenOrderBySessionDateAscStartTimeAsc(
                        trainer.getId(), monday, sunday);

        if (sessions.isEmpty()) {
            return new TrainerScheduleResponse(trainerName, weekStr, List.of());
        }

        // 4. Batch đếm booking đang chiếm chỗ (tránh N+1).
        List<Long> sessionIds = sessions.stream().map(ClassSession::getId).toList();
        Map<Long, Integer> bookedCounts = buildCountMap(sessionIds, OCCUPYING);

        // 5. Batch load tên lớp GROUP.
        List<Long> gymClassIds = sessions.stream()
                .map(ClassSession::getGymClassId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        Map<Long, String> gymClassNames = gymClassIds.isEmpty()
                ? Map.of()
                : gymClassRepository.findAllById(gymClassIds).stream()
                        .collect(Collectors.toMap(GymClass::getId, GymClass::getName));

        // 6. Tên hội viên cho buổi PRIVATE_1_1.
        Map<Long, String> private11Names = buildPrivate11Names(sessions);

        // 7. Map → SessionItem.
        List<TrainerScheduleResponse.SessionItem> items = sessions.stream()
                .map(cs -> new TrainerScheduleResponse.SessionItem(
                        cs.getId(),
                        resolveClassName(cs, gymClassNames, private11Names),
                        cs.getSessionDate().format(DATE_FMT),
                        cs.getSessionDate().getDayOfWeek().name(),
                        cs.getStartTime().format(TIME_FMT),
                        cs.getEndTime().format(TIME_FMT),
                        bookedCounts.getOrDefault(cs.getId(), 0),
                        cs.getCapacity(),
                        cs.getType().name()))
                .toList();

        return new TrainerScheduleResponse(trainerName, weekStr, items);
    }

    private String resolveClassName(ClassSession cs, Map<Long, String> gymClassNames,
                                    Map<Long, String> private11Names) {
        return switch (cs.getType()) {
            case GROUP -> cs.getGymClassId() != null
                    ? gymClassNames.getOrDefault(cs.getGymClassId(), "Lớp tập")
                    : "Lớp tập";
            case PRIVATE_1_1 -> private11Names.getOrDefault(cs.getId(), "Buổi 1-1");
            case PRIVATE_1_2 -> "Buổi 1-2";
        };
    }

    private Map<Long, Integer> buildCountMap(List<Long> sessionIds,
                                             List<Booking.BookingStatus> statuses) {
        List<Object[]> rows = bookingRepository.countByClassSessionIdInAndStatusIn(sessionIds, statuses);
        Map<Long, Integer> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put((Long) row[0], ((Long) row[1]).intValue());
        }
        return map;
    }

    private Map<Long, String> buildPrivate11Names(List<ClassSession> sessions) {
        List<Long> private11Ids = sessions.stream()
                .filter(cs -> cs.getType() == ClassSession.SessionType.PRIVATE_1_1)
                .map(ClassSession::getId)
                .toList();
        if (private11Ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> result = new HashMap<>();
        for (Long sid : private11Ids) {
            bookingRepository.findFirstByClassSessionIdAndStatusIn(sid, OCCUPYING)
                    .ifPresent(b -> memberRepository.findById(b.getMemberId())
                            .ifPresent(m -> result.put(sid, m.getFullName())));
        }
        return result;
    }

    // ---- UC5.5 — Danh sách học viên của 1 buổi học ----

    @Transactional(readOnly = true)
    public SessionAttendeesResponse getSessionAttendees(Long userId, Long sessionId) {
        // 1. Verify trainer.
        TrainerProfile trainer = trainerRepository.findByUserAccountId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ HLV"));

        // 2. Load session.
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy buổi học"));

        // 3. Security guard: buổi phải thuộc HLV này.
        if (!trainer.getId().equals(session.getTrainerId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem buổi học này");
        }

        // 4. Build sessionInfo.
        String className = resolveClassNameForSession(session);
        String trainerName = trainer.getUserAccount() != null
                ? trainer.getUserAccount().getFullName() : "HLV";
        boolean isPast = !session.getSessionDate().isAfter(LocalDate.now());

        SessionAttendeesResponse.SessionInfo info = new SessionAttendeesResponse.SessionInfo(
                session.getId(), className,
                session.getSessionDate().format(DATE_FMT),
                session.getStartTime().format(TIME_FMT),
                session.getEndTime().format(TIME_FMT),
                trainerName, isPast);

        // 5. Load bookings (mọi trạng thái, không lọc bỏ CANCELLED).
        List<Booking> bookings = bookingRepository.findByClassSessionIdOrderByBookedAtAsc(sessionId);
        if (bookings.isEmpty()) {
            return new SessionAttendeesResponse(info, List.of());
        }

        // 6. Batch-load members (tránh N+1).
        List<Long> memberIds = bookings.stream().map(Booking::getMemberId).distinct().toList();
        Map<Long, Member> members = memberRepository.findAllById(memberIds).stream()
                .collect(Collectors.toMap(Member::getId, Function.identity()));

        // 7. Sort: BOOKED/ATTENDED/NO_SHOW trước CANCELLED; trong nhóm sort theo tên.
        List<Booking> sorted = bookings.stream()
                .sorted(Comparator
                        .<Booking, Integer>comparing(b ->
                                b.getStatus() == Booking.BookingStatus.CANCELLED ? 1 : 0)
                        .thenComparing(b -> {
                            Member m = members.get(b.getMemberId());
                            return m != null ? m.getFullName() : "";
                        }))
                .toList();

        // 8. Map → AttendeeEntry.
        List<SessionAttendeesResponse.AttendeeEntry> entries = sorted.stream().map(b -> {
            Member m = members.get(b.getMemberId());
            String name = m != null ? m.getFullName() : "—";
            String phone = m != null ? m.getPhone() : null;
            String checkedInAt = b.getCheckedInAt() != null ? b.getCheckedInAt().format(DATETIME_FMT) : null;
            return new SessionAttendeesResponse.AttendeeEntry(
                    b.getId(), name, phone, b.getStatus().name(), checkedInAt);
        }).toList();

        return new SessionAttendeesResponse(info, entries);
    }

    /**
     * Tên lớp cho 1 buổi đơn lẻ (tái dùng logic UC4.4):
     * GROUP → gymClass.name; PRIVATE_1_1 → tên hội viên đầu tiên (fallback "Buổi 1-1"); PRIVATE_1_2 → "Buổi 1-2".
     */
    private String resolveClassNameForSession(ClassSession session) {
        return switch (session.getType()) {
            case GROUP -> session.getGymClassId() != null
                    ? gymClassRepository.findById(session.getGymClassId())
                            .map(GymClass::getName).orElse("Lớp tập")
                    : "Lớp tập";
            case PRIVATE_1_1 -> bookingRepository
                    .findFirstByClassSessionIdAndStatusIn(session.getId(), OCCUPYING)
                    .flatMap(b -> memberRepository.findById(b.getMemberId()))
                    .map(Member::getFullName)
                    .orElse("Buổi 1-1");
            case PRIVATE_1_2 -> "Buổi 1-2";
        };
    }

    // ---- Week helpers (giống GymClassService.parseWeekMonday/formatWeek) ----

    private LocalDate parseWeekToMonday(String week) {
        if (week == null || week.isBlank()) {
            return LocalDate.now().with(ISO.dayOfWeek(), 1);
        }
        try {
            String trimmed = week.trim();
            int dashW = trimmed.indexOf("-W");
            if (dashW < 0) {
                throw new IllegalArgumentException("missing -W");
            }
            int year = Integer.parseInt(trimmed.substring(0, dashW));
            int weekNo = Integer.parseInt(trimmed.substring(dashW + 2));
            return LocalDate.now()
                    .with(ISO.weekBasedYear(), year)
                    .with(ISO.weekOfWeekBasedYear(), weekNo)
                    .with(ISO.dayOfWeek(), 1);
        } catch (RuntimeException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "week",
                    "Định dạng tuần không hợp lệ. Yêu cầu dạng YYYY-Www (vd: 2026-W29).");
        }
    }

    private String formatWeek(LocalDate monday) {
        int year = monday.get(ISO.weekBasedYear());
        int weekNo = monday.get(ISO.weekOfWeekBasedYear());
        return String.format("%d-W%02d", year, weekNo);
    }
}
