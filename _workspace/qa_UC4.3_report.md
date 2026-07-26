# QA Report UC4.3 — Quản lý huấn luyện viên

## Kết quả: PASS

Verify tích hợp backend ↔ frontend cho UC4.3. Toàn bộ 7 nhóm checklist đạt. Không phát hiện lỗi contract hay lệch hành vi. Chỉ có vài ghi chú nhỏ (không chặn).

## Checklist

| Hạng mục | Status | Ghi chú |
|----------|--------|---------|
| **1. API Contract** | | |
| 6 endpoints URL+method khớp Controller ↔ trainers.ts | PASS | GET `/trainers`, GET `/trainers/available-accounts`, POST `/trainers`, PUT `/trainers/{id}`, PATCH `/trainers/{id}/status`, GET `/trainers/{id}/shifts` — khớp tuyệt đối |
| TrainerResponse fields (gồm totalMinutesThisWeek) khớp TS | PASS | 8 field khớp; `specialty`/`contactPhone` nullable ở TS, khớp DB NULL; `status` dùng type `Status` = 'ACTIVE'\|'INACTIVE' |
| ShiftSession fields khớp TS | PASS | sessionId, sessionDate, dayOfWeek, startTime, endTime, type, className, durationMinutes — đủ 8 |
| AvailableAccountResponse {id, fullName, email} khớp | PASS | |
| POST body {userAccountId, specialty, contactPhone} / PUT {specialty, contactPhone} | PASS | Backend `CreateTrainerRequest`/`UpdateTrainerRequest`; FE `create()` gửi 3 field, `update()` chỉ 2 field (không có userAccountId) — verify cả 2 phía |
| **2. Shifts / Week navigation** | | |
| Backend trả `week` YYYY-Www; FE dùng cho ← → | PASS | FE lần đầu không truyền week, dùng `shifts.week` backend trả; ← → gọi `shiftWeek(shifts.week, ±1)` lấy tuần liền kề từ giá trị backend (không tự sinh tuần hiện tại) |
| dayOfWeek MON..SUN → map T2..CN đúng thứ tự | PASS | `DAY_ORDER` + `DAY_LABEL` map MON→T2 … SUN→CN chuẩn |
| sessions: [] → "Chưa có lịch dạy trong tuần này." | PASS | Render đúng, không crash (filter theo day, mảng rỗng an toàn) |
| totalMinutesThisWeek → "X giờ Y phút" | PASS | `formatMinutes()`: `Math.floor(m/60)` giờ + `m%60` phút, clamp âm về 0 |
| **3. Error Handling** | | |
| E-1 (available-accounts rỗng) message nguyên văn | PASS | Khớp spec từng chữ: "Không còn tài khoản huấn luyện viên chưa được tạo hồ sơ. Vui lòng thêm tài khoản mới ở mục Tài khoản trước." |
| Business error object đơn {field, message} → highlight field | PASS | `parseApiError` bọc object đơn thành `[data]`; `applyErrors` set `fieldErrors.userAccountId` → Field dropdown hiển thị lỗi |
| Validation error mảng [{field, message}] → highlight từng field | PASS | `parseApiError` trả nguyên mảng; `applyErrors` map từng field |
| **4. Business Rules** | | |
| Soft delete → FE gọi PATCH (không DELETE) | PASS | `deactivate` → `client.patch('/trainers/{id}/status')` |
| Sau deactivate HLV biến khỏi bảng | PASS | `getAll()` filter `status = ACTIVE` (`findAllByStatusOrderByIdAsc(ACTIVE)`) |
| Form sửa không có field userAccountId | PASS | Edit modal: Họ tên read-only + specialty + contactPhone; PUT body chỉ 2 field |
| Audit log đủ 3 action | PASS | CREATE_TRAINER_PROFILE, UPDATE_TRAINER_PROFILE, DEACTIVATE_TRAINER — entity "trainer_profile" |
| **5. Phân quyền** | | |
| Tất cả endpoints Controller có @PreAuthorize ADMIN | PASS | 6/6 method có `@PreAuthorize("hasRole('ADMIN')")` |
| Route /admin/trainers có ProtectedRoute ADMIN | PASS | Nằm trong block `<ProtectedRoute allowedRoles={['ADMIN']} />` |
| **6. UI Labels** | | |
| Tiêu đề "Quản lý Huấn luyện viên" | PASS | `<h1>` trong page; Layout PAGE_TITLES cũng set (theo done-report) |
| Sidebar ADMIN "Huấn luyện viên" sau Thiết bị, trước Tài chính | PASS | Thứ tự: Thiết bị → Huấn luyện viên → Tài chính |
| Toast 3 thông điệp nguyên văn | PASS | "Thêm hồ sơ huấn luyện viên thành công!" / "Cập nhật thành công!" / "Đã ngừng hoạt động huấn luyện viên." |
| Confirm dialog nguyên văn | PASS | "Bạn có chắc muốn ngừng hoạt động huấn luyện viên này?" |
| **7. Migration V3** | | |
| 3 bảng trainer_profile, gym_class, class_session | PASS | Đủ 3 CREATE TABLE |
| trainer_profile.user_account_id UNIQUE | PASS | `CONSTRAINT uq_trainer_profile_user_account UNIQUE (user_account_id)` |
| class_session.gym_class_id nullable | PASS | `gym_class_id BIGINT NULL` + FK cho phép NULL (buổi 1-1/1-2) |

## Issues (nếu có)

Không có issue chặn. Các điểm ghi chú (thông tin, không cần sửa cho UC4.3):

1. **`TrainerService.parseWeekMonday` (dòng 238–242)** — chuỗi `LocalDate.now().withYear(year).with(ISO.weekBasedYear(), year).with(ISO.weekOfWeekBasedYear(), weekNo)...`. `withYear(year)` là thừa (bị `weekBasedYear` ghi đè) và về lý thuyết có thể ném exception ở ca hiếm (chạy đúng ngày 29/02 mà `year` không nhuận → `withYear` throw, rơi vào catch → báo "Định dạng tuần không hợp lệ" thay vì parse đúng). Xác suất cực thấp, chỉ ảnh hưởng 1 ngày/4 năm. Gợi ý (tùy chọn): bỏ `.withYear(year)`, giữ nguyên chuỗi `with(weekBasedYear).with(weekOfWeekBasedYear).with(dayOfWeek,1)`.

2. **Migration `days_of_week VARCHAR(50)`** trong khi Data Model spec ghi `SET(...)`. Đây là chủ ý (stub cho UC4.1, comment đã giải thích) và không ảnh hưởng contract UC4.3. Ghi nhận để UC4.1 đối chiếu entity mapping.

3. **`class_session` hiện chưa có seed** → cột "Tổng giờ dạy tuần này" luôn "0 giờ 0 phút" và lưới lịch luôn "Chưa có lịch dạy trong tuần này." Đây là hành vi ĐÚNG cho tới khi UC4.1/UC5.2 populate — không phải bug.

## Điểm tốt

- **Contract khớp tuyệt đối**: tên field, kiểu, nullable giữa record DTO backend và interface TS đồng nhất; `totalMinutesThisWeek` để dạng số phút (long) và FE tự format — đúng phân định trách nhiệm trong spec.
- **Xử lý lỗi 2 dạng thống nhất**: `parseApiError` + `applyErrors` chuẩn hoá cả object đơn (business) lẫn mảng (validation) và highlight đúng field `userAccountId` — khớp GlobalExceptionHandler.
- **Week navigation chính xác**: FE dùng đúng `week` backend trả làm mốc, tự viết helper ISO week (UTC) để dịch tuần, tránh lệch timezone và tránh tính lại tuần hiện tại.
- **Soft-delete đúng nghiệp vụ**: PATCH status, chỉ đổi INACTIVE, không xóa; `getAll` chỉ trả ACTIVE nên HLV biến khỏi bảng đúng mong đợi; audit đủ 3 action.
- **Migration an toàn FK**: seed 3 HLV bằng `INSERT ... SELECT` (không hardcode id, kiểm tra NOT EXISTS) — không vỡ khi thứ tự seed user_account thay đổi.
- **Phân quyền chặt cả 2 tầng**: `@PreAuthorize` ở mọi endpoint + `ProtectedRoute allowedRoles={['ADMIN']}` ở route.
