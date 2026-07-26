# Backend UC4.3 — Quản lý huấn luyện viên — DONE

Build: `mvn -o clean compile` → **BUILD SUCCESS**.

## Files đã tạo

### Module `com.picore.trainer` (FULL)
- `TrainerProfile.java` — Entity JPA (id, `@ManyToOne` userAccount FK unique, specialty, contactPhone, status ACTIVE/INACTIVE, createdAt). Không Lombok, getter/setter thủ công.
- `TrainerRepository.java` — `findAllByStatusOrderByIdAsc`, `existsByUserAccountId`, `findByUserAccountId`.
- `TrainerService.java` — `@Transactional`; getAll / getAvailableAccounts / create / update / deactivate / getShifts; audit log; parse tuần ISO.
- `TrainerController.java` — `@PreAuthorize("hasRole('ADMIN')")`, `@RequestMapping("/trainers")` (context-path `/api`).
- `dto/`: `CreateTrainerRequest`, `UpdateTrainerRequest`, `TrainerResponse`, `AvailableAccountResponse`, `TrainerShiftsResponse`, `ShiftSession` (records).

### Module `com.picore.clazz` (STUB — Entity + Repo, chưa có Controller/Service)
- `GymClass.java` / `GymClassRepository.java` — stub lớp cố định, dùng để resolve tên lớp trong lưới ca.
- `ClassSession.java` / `ClassSessionRepository.java` — stub buổi tập; chứa `sumMinutesInRange` (native TIMESTAMPDIFF) và `findByTrainerIdAndSessionDateBetween...`.

### Migration
- `db/migration/V3__create_trainer_and_class_tables.sql` — tạo 3 bảng `trainer_profile`, `gym_class`, `class_session` + index + seed 3 HLV (INSERT…SELECT từ user_account role=TRAINER, an toàn FK, không hardcode id).

## API summary (đều ADMIN-only, prefix `/api`)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/trainers` | List HLV **ACTIVE**, kèm `totalMinutesThisWeek` (tuần hiện tại) |
| GET | `/api/trainers/available-accounts` | Tài khoản role=TRAINER chưa có hồ sơ |
| POST | `/api/trainers` | Tạo hồ sơ → **201** |
| PUT | `/api/trainers/{id}` | Sửa specialty/contactPhone |
| PATCH | `/api/trainers/{id}/status` | Soft delete → INACTIVE |
| GET | `/api/trainers/{id}/shifts?week=YYYY-Www` | Lưới ca tuần (derived) |

### Shape response
- `TrainerResponse`: `{ id, userAccountId, fullName, email, specialty, contactPhone, status, totalMinutesThisWeek }` — `totalMinutesThisWeek` là **số phút** (long), FE tự format "X giờ Y phút".
- `AvailableAccountResponse`: `{ id, fullName, email }`.
- `TrainerShiftsResponse`: `{ week: "2026-W29", sessions: [ShiftSession] }`.
- `ShiftSession`: `{ sessionId, sessionDate (yyyy-MM-dd), dayOfWeek ("MON".."SUN"), startTime ("HH:mm"), endTime ("HH:mm"), type, className, durationMinutes }`.

### Error responses (đúng nguyên văn spec, field = `userAccountId`)
- Tài khoản không tồn tại / không phải TRAINER → `{ "field": "userAccountId", "message": "Tài khoản không tồn tại hoặc không phải huấn luyện viên" }`
- Đã có hồ sơ → `{ "field": "userAccountId", "message": "Tài khoản này đã có hồ sơ huấn luyện viên" }`
- Week sai định dạng → `{ "field": "week", "message": "Định dạng tuần không hợp lệ. Yêu cầu dạng YYYY-Www (vd: 2026-W29)." }`
- Không tìm thấy HLV → 404 `{ "message": "Không tìm thấy huấn luyện viên" }`

Lưu ý format lỗi (theo `GlobalExceptionHandler` sẵn có):
- Lỗi `@Valid` (thiếu `userAccountId`) trả về **mảng** `[{field, message}]` (400).
- Lỗi nghiệp vụ `ApiException` trả về **object đơn** `{field, message}` hoặc `{message}`.

## Điểm lưu ý cho frontend

1. **`totalMinutesThisWeek` = số phút** (không phải "X giờ Y phút"). FE format: `Math.floor(m/60)` giờ + `m%60` phút. Bằng 0 khi chưa có session (class_session hiện trống → luôn 0 cho tới khi UC4.1/UC5.2 populate).
2. **Shifts luôn trả `sessions: []`** cho tới khi UC4.1/UC5.2 tạo `class_session`. FE hiển thị "Chưa có lịch dạy trong tuần này." khi rỗng.
3. **Week param optional**: bỏ trống → backend dùng tuần hiện tại và trả `week` đã chuẩn hoá về `YYYY-Www` trong response (FE dùng giá trị này cho nút ← →).
4. `dayOfWeek` trả `MON..SUN` (viết tắt tiếng Anh) — FE tự map sang T2..CN.
5. **GET /api/trainers chỉ trả HLV ACTIVE.** Chưa có endpoint list gồm INACTIVE (spec không yêu cầu). HLV INACTIVE biến mất khỏi bảng sau khi deactivate — khớp business rule.
6. `available-accounts` rỗng → FE hiển thị thông báo E-1: "Không còn tài khoản huấn luyện viên chưa được tạo hồ sơ. Vui lòng thêm tài khoản mới ở mục Tài khoản trước."
7. POST body: `{ userAccountId, specialty, contactPhone }`. PUT body: `{ specialty, contactPhone }`. PATCH status: không cần body.
8. Audit actions: `CREATE_TRAINER_PROFILE` / `UPDATE_TRAINER_PROFILE` / `DEACTIVATE_TRAINER`, entity = `trainer_profile`.

## Chưa làm (ngoài scope UC4.3 backend)
- Frontend (AdminTrainersPage, api/trainers.ts, types/trainer.ts, sửa App.tsx + Sidebar.tsx) — theo spec phần Frontend.
- UC4.1 Controller/Service cho GymClass/ClassSession (chỉ tạo stub Entity+Repo ở đây).
