# Backend UC4.4 — Xem lịch dạy của HLV — DONE

## Kết quả
`mvn clean compile -q` PASS. Không lỗi.

## Files tạo mới
- `backend/src/main/java/com/picore/trainer/dto/TrainerScheduleResponse.java` — record `TrainerScheduleResponse(trainerName, week, sessions)` + nested `SessionItem`.
- `backend/src/main/java/com/picore/trainer/TrainerScheduleService.java` — `@Service`, method `getSchedule(userId, week)`, `@Transactional(readOnly = true)`.
- `backend/src/main/java/com/picore/trainer/TrainerScheduleController.java` — `@RestController`, `GET /api/trainer/schedule`.

## Files sửa
- `backend/src/main/java/com/picore/booking/BookingRepository.java` — thêm 2 method:
  - `countByClassSessionIdInAndStatusIn(sessionIds, statuses)` → `List<Object[]>` (JPQL GROUP BY, batch đếm tránh N+1)
  - `findFirstByClassSessionIdAndStatusIn(classSessionId, statuses)` → `Optional<Booking>` (lấy hội viên buổi 1-1)
  - thêm import `java.util.Optional`

## Lưu ý khác spec (đã điều chỉnh cho khớp codebase)
- **ApiException**: dự án dùng `new ApiException(HttpStatus.NOT_FOUND, msg)` — KHÔNG phải int code như spec ví dụ. Đã dùng đúng `HttpStatus`.
- **Auth**: dự án dùng `@AuthenticationPrincipal UserPrincipal principal` rồi `principal.id()` (record `UserPrincipal`), KHÔNG phải `@AuthenticationPrincipal Long userId`. Đã theo pattern chuẩn của MeController/BookingController.
- **Context-path = `/api`** (application.yml `server.servlet.context-path`). Nên controller map `@RequestMapping("/trainer")` + `@GetMapping("/schedule")` = URL cuối `GET /api/trainer/schedule`.
- **ClassSessionRepository**: method `findByTrainerIdAndSessionDateBetweenOrderBySessionDateAscStartTimeAsc` ĐÃ CÓ SẴN (từ UC4.3) — không cần thêm.
- **Week helper**: copy logic `parseWeekMonday`/`formatWeek` từ `GymClassService` (ISO week `YYYY-Www`). Không tạo `common/WeekUtils` để giữ thay đổi tối thiểu; nếu muốn refactor chung sau này thì extract cả 2 service.
- **bookedCount**: đếm status IN (BOOKED, ATTENDED).
- **className**: GROUP → tên gym_class (fallback "Lớp tập"); PRIVATE_1_1 → tên hội viên (fallback "Buổi 1-1"); PRIVATE_1_2 → "Buổi 1-2".

## Notes cho Frontend Dev
- Endpoint: `GET /api/trainer/schedule?week=YYYY-Www` (week optional, mặc định tuần hiện tại). Role TRAINER.
- Response JSON:
  ```json
  {
    "trainerName": "Nguyễn Văn A",
    "week": "2026-W30",
    "sessions": [
      {
        "sessionId": 12,
        "className": "Reformer Cơ bản",
        "sessionDate": "2026-07-20",
        "dayOfWeek": "MONDAY",
        "startTime": "07:00",
        "endTime": "08:00",
        "bookedCount": 3,
        "capacity": 8,
        "type": "GROUP"
      }
    ]
  }
  ```
- Tuần trống → `sessions: []` (không phải lỗi) → FE hiện E-1 "Chưa có lịch dạy trong tuần này".
- `dayOfWeek` là "MONDAY".."SUNDAY" (viết hoa đầy đủ) — dùng để nhóm 7 cột T2→CN.
- `startTime`/`endTime` đã format "HH:mm", `sessionDate` "yyyy-MM-dd" — dùng trực tiếp, không cần parse lại.
- Click card → `navigate('/trainer/session/' + sessionId + '/attendees')` (UC5.5, làm sau).
- Màu card theo `type`: GROUP=teal, PRIVATE_1_1=xanh dương, PRIVATE_1_2=tím.
