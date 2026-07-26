package com.picore.clazz;

import com.picore.auth.UserAccount;
import com.picore.booking.Booking;
import com.picore.booking.BookingRepository;
import com.picore.clazz.dto.CreateClassRequest;
import com.picore.clazz.dto.GymClassResponse;
import com.picore.clazz.dto.TimetableResponse;
import com.picore.clazz.dto.TimetableSession;
import com.picore.clazz.dto.UpdateClassRequest;
import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.trainer.TrainerProfile;
import com.picore.trainer.TrainerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.time.temporal.WeekFields;

@Service
@Transactional
public class GymClassService {

    private static final WeekFields ISO = WeekFields.ISO;
    private static final int HORIZON_WEEKS = 8;

    private static final List<Booking.BookingStatus> OCCUPYING =
            List.of(Booking.BookingStatus.BOOKED, Booking.BookingStatus.ATTENDED);

    private final GymClassRepository gymClassRepository;
    private final ClassSessionRepository classSessionRepository;
    private final TrainerRepository trainerRepository;
    private final AuditLogService auditLogService;
    private final BookingRepository bookingRepository;
    private final MemberRepository memberRepository;

    public GymClassService(GymClassRepository gymClassRepository,
                           ClassSessionRepository classSessionRepository,
                           TrainerRepository trainerRepository,
                           AuditLogService auditLogService,
                           BookingRepository bookingRepository,
                           MemberRepository memberRepository) {
        this.gymClassRepository = gymClassRepository;
        this.classSessionRepository = classSessionRepository;
        this.trainerRepository = trainerRepository;
        this.auditLogService = auditLogService;
        this.bookingRepository = bookingRepository;
        this.memberRepository = memberRepository;
    }

    @Transactional(readOnly = true)
    public List<GymClassResponse> getAll() {
        List<GymClass> classes = gymClassRepository
                .findAllByStatusOrderByIdAsc(GymClass.GymClassStatus.ACTIVE);
        Map<Long, String> trainerNames = resolveTrainerNames(classes.stream()
                .map(GymClass::getTrainerId)
                .filter(id -> id != null)
                .distinct()
                .toList());
        return classes.stream()
                .map(c -> toResponse(c, trainerNames.get(c.getTrainerId())))
                .toList();
    }

    @Transactional
    public GymClassResponse create(CreateClassRequest req, Long actorId) {
        if (gymClassRepository.existsByName(req.name())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "name", "Tên lớp học đã tồn tại");
        }

        Set<DayOfWeek> days = parseDays(req.daysOfWeek());
        validateTimeRange(req.startTime(), req.endTime());
        TrainerProfile trainer = requireTrainer(req.trainerId());

        LocalDate monday = LocalDate.now().with(ISO.dayOfWeek(), 1);
        LocalDate horizonEnd = monday.plusWeeks(HORIZON_WEEKS);
        checkPrivateConflict(trainer.getId(), days, req.startTime(), req.endTime(), monday, horizonEnd);

        GymClass gymClass = new GymClass();
        gymClass.setName(req.name());
        gymClass.setEquipmentType(req.equipmentType());
        gymClass.setTrainerId(trainer.getId());
        gymClass.setDaysOfWeek(formatDays(days));
        gymClass.setStartTime(req.startTime());
        gymClass.setEndTime(req.endTime());
        gymClass.setCapacity(req.capacity());
        gymClass.setDescription(req.description());
        gymClass.setStatus(GymClass.GymClassStatus.ACTIVE);
        gymClass = gymClassRepository.save(gymClass);

        generateSessions(gymClass, days, monday, horizonEnd);

        auditLogService.log(actorId, "CREATE_CLASS", "gym_class", gymClass.getId(),
                "Tạo lớp học: " + gymClass.getName());

        return toResponse(gymClass, trainerName(trainer));
    }

    @Transactional
    public GymClassResponse update(Long id, UpdateClassRequest req, Long actorId) {
        GymClass gymClass = gymClassRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học"));

        if (gymClassRepository.existsByNameAndIdNot(req.name(), id)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "name", "Tên lớp học đã tồn tại");
        }

        Set<DayOfWeek> days = parseDays(req.daysOfWeek());
        validateTimeRange(req.startTime(), req.endTime());
        TrainerProfile trainer = requireTrainer(req.trainerId());

        LocalDate monday = LocalDate.now().with(ISO.dayOfWeek(), 1);
        LocalDate horizonEnd = monday.plusWeeks(HORIZON_WEEKS);
        checkPrivateConflict(trainer.getId(), days, req.startTime(), req.endTime(), monday, horizonEnd);

        gymClass.setName(req.name());
        gymClass.setEquipmentType(req.equipmentType());
        gymClass.setTrainerId(trainer.getId());
        gymClass.setDaysOfWeek(formatDays(days));
        gymClass.setStartTime(req.startTime());
        gymClass.setEndTime(req.endTime());
        gymClass.setCapacity(req.capacity());
        gymClass.setDescription(req.description());
        gymClass = gymClassRepository.save(gymClass);

        // Xóa sessions từ ngày mai trở đi, giữ lại sessions đã qua/hôm nay, rồi re-generate.
        LocalDate today = LocalDate.now();
        classSessionRepository.deleteFutureSessionsByGymClassId(id, today);
        LocalDate regenStart = today.plusDays(1);
        generateSessions(gymClass, days, regenStart, horizonEnd);

        auditLogService.log(actorId, "UPDATE_CLASS", "gym_class", gymClass.getId(),
                "Cập nhật lớp học: " + gymClass.getName());

        return toResponse(gymClass, trainerName(trainer));
    }

    @Transactional
    public GymClassResponse deactivate(Long id, Long actorId) {
        GymClass gymClass = gymClassRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy lớp học"));

        gymClass.setStatus(GymClass.GymClassStatus.INACTIVE);
        gymClass = gymClassRepository.save(gymClass);

        classSessionRepository.deleteFutureSessionsByGymClassId(id, LocalDate.now());

        auditLogService.log(actorId, "DEACTIVATE_CLASS", "gym_class", gymClass.getId(),
                "Ngừng hoạt động lớp học: " + gymClass.getName());

        String tName = gymClass.getTrainerId() != null
                ? resolveTrainerNames(List.of(gymClass.getTrainerId())).get(gymClass.getTrainerId())
                : null;
        return toResponse(gymClass, tName);
    }

    @Transactional(readOnly = true)
    public TimetableResponse getTimetable(String week, Long currentUserId) {
        LocalDate monday = parseWeekMonday(week);
        LocalDate sunday = monday.plusDays(6);
        String weekLabel = formatWeek(monday);

        List<ClassSession> sessions = classSessionRepository
                .findByGymClassIdIsNotNullAndSessionDateBetweenOrderBySessionDateAscStartTimeAsc(monday, sunday);

        List<Long> classIds = sessions.stream()
                .map(ClassSession::getGymClassId)
                .filter(cid -> cid != null)
                .distinct()
                .toList();
        Map<Long, GymClass> classMap = classIds.isEmpty()
                ? Map.of()
                : gymClassRepository.findAllById(classIds).stream()
                        .collect(Collectors.toMap(GymClass::getId, c -> c));

        List<Long> trainerIds = sessions.stream()
                .map(ClassSession::getTrainerId)
                .filter(tid -> tid != null)
                .distinct()
                .toList();
        Map<Long, String> trainerNames = resolveTrainerNames(trainerIds);

        List<Long> sessionIds = sessions.stream().map(ClassSession::getId).toList();

        // bookedCount thực tế theo từng buổi (các booking đang chiếm chỗ).
        Map<Long, Integer> bookedCounts = sessionIds.isEmpty()
                ? Map.of()
                : bookingRepository.findByClassSessionIdInAndStatusIn(sessionIds, OCCUPYING).stream()
                        .collect(Collectors.groupingBy(Booking::getClassSessionId,
                                Collectors.summingInt(b -> 1)));

        // myBookingStatus: chỉ khi là MEMBER — batch-query booking của user cho các buổi hiển thị.
        Map<Long, String> myStatus = Map.of();
        if (currentUserId != null && !sessionIds.isEmpty()) {
            Member member = memberRepository.findByUserAccountId(currentUserId).orElse(null);
            if (member != null) {
                myStatus = bookingRepository
                        .findByMemberIdAndClassSessionIdIn(member.getId(), sessionIds).stream()
                        // Nếu có nhiều bản ghi cho cùng buổi (vd đặt rồi hủy), ưu tiên trạng thái đang chiếm chỗ.
                        .collect(Collectors.toMap(
                                Booking::getClassSessionId,
                                b -> b.getStatus().name(),
                                GymClassService::preferActiveStatus));
            }
        }

        final Map<Long, String> myStatusFinal = myStatus;
        List<TimetableSession> items = sessions.stream()
                .map(s -> {
                    GymClass gc = classMap.get(s.getGymClassId());
                    String className = gc != null ? gc.getName() : "Lớp nhóm";
                    String trainerName = trainerNames.get(s.getTrainerId());
                    String dayOfWeek = s.getSessionDate().getDayOfWeek().name().substring(0, 3);
                    int bookedCount = bookedCounts.getOrDefault(s.getId(), 0);
                    int availableSpots = s.getCapacity() - bookedCount;
                    String myBookingStatus = myStatusFinal.get(s.getId());
                    return new TimetableSession(
                            s.getId(),
                            s.getGymClassId(),
                            className,
                            trainerName,
                            s.getSessionDate(),
                            dayOfWeek,
                            s.getStartTime(),
                            s.getEndTime(),
                            s.getCapacity(),
                            bookedCount,
                            availableSpots,
                            myBookingStatus);
                })
                .toList();

        return new TimetableResponse(weekLabel, items);
    }

    // Khi hội viên có nhiều booking cho cùng buổi, ưu tiên trạng thái đang chiếm chỗ (BOOKED/ATTENDED)
    // hơn các trạng thái CANCELLED/NO_SHOW để hiển thị đúng nút trên timetable.
    private static String preferActiveStatus(String a, String b) {
        if ("BOOKED".equals(a) || "ATTENDED".equals(a)) {
            return a;
        }
        if ("BOOKED".equals(b) || "ATTENDED".equals(b)) {
            return b;
        }
        return a;
    }

    // ---- Helpers ----

    private void generateSessions(GymClass gymClass, Set<DayOfWeek> days,
                                  LocalDate fromInclusive, LocalDate toExclusive) {
        List<ClassSession> sessions = new ArrayList<>();
        for (LocalDate d = fromInclusive; d.isBefore(toExclusive); d = d.plusDays(1)) {
            if (days.contains(d.getDayOfWeek())) {
                ClassSession s = new ClassSession();
                s.setGymClassId(gymClass.getId());
                s.setTrainerId(gymClass.getTrainerId());
                s.setSessionDate(d);
                s.setStartTime(gymClass.getStartTime());
                s.setEndTime(gymClass.getEndTime());
                s.setType(ClassSession.SessionType.GROUP);
                s.setCapacity(gymClass.getCapacity());
                sessions.add(s);
            }
        }
        if (!sessions.isEmpty()) {
            classSessionRepository.saveAll(sessions);
        }
    }

    private void checkPrivateConflict(Long trainerId, Set<DayOfWeek> days,
                                      LocalTime startTime, LocalTime endTime,
                                      LocalDate start, LocalDate endExclusive) {
        List<ClassSession> conflicts = classSessionRepository.findConflictingPrivateSessions(
                trainerId, start, endExclusive.minusDays(1), startTime, endTime);
        boolean hasConflict = conflicts.stream()
                .anyMatch(cs -> days.contains(cs.getSessionDate().getDayOfWeek()));
        if (hasConflict) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "trainerId",
                    "Huấn luyện viên đã có buổi dạy 1-1/1-2 vào khung giờ này. "
                            + "Vui lòng chọn giờ khác hoặc đổi huấn luyện viên.");
        }
    }

    private TrainerProfile requireTrainer(Long trainerId) {
        return trainerRepository.findById(trainerId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "trainerId",
                        "Huấn luyện viên không tồn tại"));
    }

    private void validateTimeRange(LocalTime start, LocalTime end) {
        if (start != null && end != null && !end.isAfter(start)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "endTime",
                    "Giờ kết thúc phải sau giờ bắt đầu");
        }
    }

    private Map<Long, String> resolveTrainerNames(List<Long> trainerIds) {
        if (trainerIds.isEmpty()) {
            return Map.of();
        }
        return trainerRepository.findAllById(trainerIds).stream()
                .collect(Collectors.toMap(TrainerProfile::getId, this::trainerName));
    }

    private String trainerName(TrainerProfile t) {
        UserAccount ua = t.getUserAccount();
        return ua != null ? ua.getFullName() : null;
    }

    private GymClassResponse toResponse(GymClass c, String trainerName) {
        return new GymClassResponse(
                c.getId(),
                c.getName(),
                c.getEquipmentType(),
                c.getTrainerId(),
                trainerName,
                splitDays(c.getDaysOfWeek()),
                c.getStartTime(),
                c.getEndTime(),
                c.getCapacity(),
                c.getDescription(),
                c.getStatus() != null ? c.getStatus().name() : null);
    }

    private Set<DayOfWeek> parseDays(List<String> codes) {
        Set<DayOfWeek> result = EnumSet.noneOf(DayOfWeek.class);
        for (String code : codes) {
            result.add(parseDay(code));
        }
        return result;
    }

    private DayOfWeek parseDay(String code) {
        if (code == null) {
            throw invalidDay();
        }
        String trimmed = code.trim().toUpperCase();
        for (DayOfWeek d : DayOfWeek.values()) {
            if (d.name().substring(0, 3).equals(trimmed) || d.name().equals(trimmed)) {
                return d;
            }
        }
        throw invalidDay();
    }

    private ApiException invalidDay() {
        return new ApiException(HttpStatus.BAD_REQUEST, "daysOfWeek", "Ngày trong tuần không hợp lệ");
    }

    private String formatDays(Set<DayOfWeek> days) {
        return days.stream()
                .sorted()
                .map(d -> d.name().substring(0, 3))
                .collect(Collectors.joining(","));
    }

    private List<String> splitDays(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private LocalDate parseWeekMonday(String week) {
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
