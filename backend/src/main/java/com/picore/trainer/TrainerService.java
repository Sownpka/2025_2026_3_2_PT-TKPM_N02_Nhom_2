package com.picore.trainer;

import com.picore.auth.UserAccount;
import com.picore.auth.UserAccountRepository;
import com.picore.clazz.ClassSession;
import com.picore.clazz.ClassSessionRepository;
import com.picore.clazz.GymClass;
import com.picore.clazz.GymClassRepository;
import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.trainer.dto.AvailableAccountResponse;
import com.picore.trainer.dto.AvailableTrainerResponse;
import com.picore.trainer.dto.CreateTrainerRequest;
import com.picore.trainer.dto.ShiftSession;
import com.picore.trainer.dto.TrainerResponse;
import com.picore.trainer.dto.TrainerShiftsResponse;
import com.picore.trainer.dto.UpdateTrainerRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
public class TrainerService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final WeekFields ISO = WeekFields.ISO;

    private final TrainerRepository trainerRepository;
    private final UserAccountRepository userAccountRepository;
    private final ClassSessionRepository classSessionRepository;
    private final GymClassRepository gymClassRepository;
    private final AuditLogService auditLogService;

    public TrainerService(TrainerRepository trainerRepository,
                          UserAccountRepository userAccountRepository,
                          ClassSessionRepository classSessionRepository,
                          GymClassRepository gymClassRepository,
                          AuditLogService auditLogService) {
        this.trainerRepository = trainerRepository;
        this.userAccountRepository = userAccountRepository;
        this.classSessionRepository = classSessionRepository;
        this.gymClassRepository = gymClassRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<TrainerResponse> getAll() {
        LocalDate monday = LocalDate.now().with(ISO.dayOfWeek(), 1);
        LocalDate sunday = monday.plusDays(6);

        return trainerRepository.findAllByStatusOrderByIdAsc(TrainerProfile.TrainerStatus.ACTIVE)
                .stream()
                .map(t -> {
                    long minutes = classSessionRepository.sumMinutesInRange(t.getId(), monday, sunday);
                    return TrainerResponse.from(t, minutes);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AvailableAccountResponse> getAvailableAccounts() {
        // Tài khoản role = TRAINER và chưa có trainer_profile.
        return userAccountRepository.findAll().stream()
                .filter(u -> u.getRole() == UserAccount.Role.TRAINER)
                .filter(u -> !trainerRepository.existsByUserAccountId(u.getId()))
                .sorted((a, b) -> Long.compare(a.getId(), b.getId()))
                .map(u -> new AvailableAccountResponse(u.getId(), u.getFullName(), u.getEmail()))
                .toList();
    }

    @Transactional
    public TrainerResponse create(CreateTrainerRequest req, Long actorId) {
        UserAccount account = userAccountRepository.findById(req.userAccountId())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "userAccountId",
                        "Tài khoản không tồn tại hoặc không phải huấn luyện viên"));

        if (account.getRole() != UserAccount.Role.TRAINER) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "userAccountId",
                    "Tài khoản không tồn tại hoặc không phải huấn luyện viên");
        }

        if (trainerRepository.existsByUserAccountId(account.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "userAccountId",
                    "Tài khoản này đã có hồ sơ huấn luyện viên");
        }

        TrainerProfile t = new TrainerProfile();
        t.setUserAccount(account);
        t.setSpecialty(req.specialty());
        t.setContactPhone(req.contactPhone());
        t.setStatus(TrainerProfile.TrainerStatus.ACTIVE);

        try {
            t = trainerRepository.saveAndFlush(t);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "userAccountId",
                    "Tài khoản này đã có hồ sơ huấn luyện viên");
        }

        auditLogService.log(actorId, "CREATE_TRAINER_PROFILE", "trainer_profile", t.getId(),
                "Tạo hồ sơ huấn luyện viên: " + account.getFullName() + " - " + account.getEmail());

        return TrainerResponse.from(t, 0);
    }

    @Transactional
    public TrainerResponse update(Long id, UpdateTrainerRequest req, Long actorId) {
        TrainerProfile t = trainerRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy huấn luyện viên"));

        t.setSpecialty(req.specialty());
        t.setContactPhone(req.contactPhone());
        t = trainerRepository.save(t);

        auditLogService.log(actorId, "UPDATE_TRAINER_PROFILE", "trainer_profile", t.getId(),
                "Cập nhật hồ sơ huấn luyện viên id=" + t.getId());

        long minutes = currentWeekMinutes(t.getId());
        return TrainerResponse.from(t, minutes);
    }

    @Transactional
    public TrainerResponse deactivate(Long id, Long actorId) {
        TrainerProfile t = trainerRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy huấn luyện viên"));

        // Soft delete: chỉ đổi status = INACTIVE, không xóa. Lớp đã gán không đổi.
        t.setStatus(TrainerProfile.TrainerStatus.INACTIVE);
        t = trainerRepository.save(t);

        auditLogService.log(actorId, "DEACTIVATE_TRAINER", "trainer_profile", t.getId(),
                "Ngừng hoạt động huấn luyện viên id=" + t.getId());

        long minutes = currentWeekMinutes(t.getId());
        return TrainerResponse.from(t, minutes);
    }

    @Transactional(readOnly = true)
    public TrainerShiftsResponse getShifts(Long id, String week) {
        TrainerProfile t = trainerRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy huấn luyện viên"));

        LocalDate monday = parseWeekMonday(week);
        LocalDate sunday = monday.plusDays(6);
        String weekLabel = formatWeek(monday);

        List<ClassSession> sessions = classSessionRepository
                .findByTrainerIdAndSessionDateBetweenOrderBySessionDateAscStartTimeAsc(t.getId(), monday, sunday);

        // Resolve tên lớp cho các buổi gắn với gym_class (tránh N+1).
        List<Long> classIds = sessions.stream()
                .map(ClassSession::getGymClassId)
                .filter(cid -> cid != null)
                .distinct()
                .toList();
        Map<Long, String> classNames = classIds.isEmpty()
                ? Map.of()
                : gymClassRepository.findAllById(classIds).stream()
                        .collect(Collectors.toMap(GymClass::getId, GymClass::getName));

        List<ShiftSession> shiftSessions = sessions.stream()
                .map(s -> toShiftSession(s, classNames))
                .toList();

        return new TrainerShiftsResponse(weekLabel, shiftSessions);
    }

    /**
     * HLV ACTIVE không có bất kỳ buổi (GROUP/PRIVATE) nào chồng lấn khung giờ + ngày trong 8 tuần tới.
     * id trả về = trainer_profile.id.
     */
    @Transactional(readOnly = true)
    public List<AvailableTrainerResponse> getAvailableForClass(List<String> days,
                                                               LocalTime startTime, LocalTime endTime) {
        Set<DayOfWeek> requestedDays = parseDays(days);
        LocalDate monday = LocalDate.now().with(ISO.dayOfWeek(), 1);
        LocalDate horizonEnd = monday.plusWeeks(8).minusDays(1); // inclusive end

        return trainerRepository.findAllByStatusOrderByIdAsc(TrainerProfile.TrainerStatus.ACTIVE)
                .stream()
                .filter(t -> {
                    List<ClassSession> conflicts = classSessionRepository.findConflictingSessions(
                            t.getId(), monday, horizonEnd, startTime, endTime);
                    return conflicts.stream()
                            .noneMatch(cs -> requestedDays.contains(cs.getSessionDate().getDayOfWeek()));
                })
                .map(t -> new AvailableTrainerResponse(
                        t.getId(),
                        t.getUserAccount() != null ? t.getUserAccount().getFullName() : null))
                .toList();
    }

    private Set<DayOfWeek> parseDays(List<String> codes) {
        Set<DayOfWeek> result = EnumSet.noneOf(DayOfWeek.class);
        if (codes == null) {
            return result;
        }
        for (String code : codes) {
            if (code == null) {
                continue;
            }
            String trimmed = code.trim().toUpperCase();
            for (DayOfWeek d : DayOfWeek.values()) {
                if (d.name().substring(0, 3).equals(trimmed) || d.name().equals(trimmed)) {
                    result.add(d);
                    break;
                }
            }
        }
        return result;
    }

    // ---- Helpers ----

    private long currentWeekMinutes(Long trainerId) {
        LocalDate monday = LocalDate.now().with(ISO.dayOfWeek(), 1);
        LocalDate sunday = monday.plusDays(6);
        return classSessionRepository.sumMinutesInRange(trainerId, monday, sunday);
    }

    private ShiftSession toShiftSession(ClassSession s, Map<Long, String> classNames) {
        long duration = Duration.between(s.getStartTime(), s.getEndTime()).toMinutes();
        String dayOfWeek = s.getSessionDate().getDayOfWeek().name().substring(0, 3); // MON..SUN
        String className = resolveClassName(s, classNames);
        return new ShiftSession(
                s.getId(),
                s.getSessionDate(),
                dayOfWeek,
                fmtTime(s.getStartTime()),
                fmtTime(s.getEndTime()),
                s.getType() != null ? s.getType().name() : null,
                className,
                duration
        );
    }

    private String resolveClassName(ClassSession s, Map<Long, String> classNames) {
        if (s.getGymClassId() != null) {
            String name = classNames.get(s.getGymClassId());
            if (name != null) {
                return name;
            }
        }
        if (s.getType() == ClassSession.SessionType.PRIVATE_1_1) {
            return "Buổi 1-1";
        }
        if (s.getType() == ClassSession.SessionType.PRIVATE_1_2) {
            return "Buổi 1-2";
        }
        return "Lớp nhóm";
    }

    private String fmtTime(LocalTime time) {
        return time != null ? time.format(TIME_FMT) : null;
    }

    /**
     * Parse `week` dạng ISO 8601 `YYYY-Www` → ngày Thứ 2 của tuần đó.
     * Null/blank → tuần hiện tại.
     */
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
