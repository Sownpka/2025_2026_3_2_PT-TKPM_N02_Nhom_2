# Backend NFR — Kết quả thực hiện

Ngày: 2026-07-19 | Người thực hiện: backend-dev
Trạng thái compile: **COMPILE_OK** (`mvn compile -q`)

---

## Nhóm 1 — Audit log cho 3 service

Signature xác nhận: `AuditLogService.log(Long actorId, String action, String entity, Long entityId, String detail)`

### 1a. AttendanceService
`backend/src/main/java/com/picore/attendance/AttendanceService.java`
- Inject `AuditLogService` vào constructor.
- `checkIn(bookingId)` → `log(0L, "CHECK_IN", "booking", bookingId, "Check-in bookingId=" + bookingId)`
- `markNoShow(bookingId)` → `log(0L, "MARK_NO_SHOW", "booking", bookingId, "No-show bookingId=" + bookingId)`
- `quickCheckin(phone)` → `log(0L, "QUICK_CHECKIN", "member", member.getId(), "Walk-in: " + member.getPhone())`
- actorId=0L theo ghi chú (controller không có @AuthenticationPrincipal).

### 1b. BookingService
`backend/src/main/java/com/picore/booking/BookingService.java`
- Inject `AuditLogService` vào constructor.
- Log đặt lịch đặt trong `doBook(...)` (nơi hội tụ của `bookSession` và `bookSessionForMember`), sau `save`:
  `log(memberId, "CREATE_BOOKING", "booking", saved.getId(), "Đặt lịch sessionId=" + classSessionId)`
- Log hủy lịch đặt trong `cancelInternal(...)` (nơi hội tụ của `cancelBooking` và `cancelBookingAsStaff`), sau `save`:
  `log(booking.getMemberId(), "CANCEL_BOOKING", "booking", bookingId, "Hủy lịch bookingId=" + bookingId)`
- Ghi chú: dùng `booking.getMemberId()` thay vì tham số ownerMemberId vì bản staff-cancel truyền null.

### 1c. FinanceService
`backend/src/main/java/com/picore/finance/FinanceService.java`
- Inject `AuditLogService` vào constructor.
- `addExpense(userId, req)` → sau save: `log(userId, "ADD_EXPENSE", "expense", saved.getId(), saved.getCategory() + " " + saved.getAmount())`
- `updateExpense(id, userId, req)` → sau save: `log(userId, "UPDATE_EXPENSE", "expense", id, "Cập nhật khoản chi id=" + id)`
- `deleteExpense(id, userId)` → trước delete: `log(userId, "DELETE_EXPENSE", "expense", id, "Xóa khoản chi id=" + id)`
  - **Thay đổi signature**: trước đây là `deleteExpense(Long id)`, nay thành `deleteExpense(Long id, Long userId)` để có actorId theo yêu cầu.
  - Cập nhật kèm `FinanceController.deleteExpense(...)`: thêm `@AuthenticationPrincipal UserPrincipal principal` và gọi `financeService.deleteExpense(id, principal.id())`.

---

## Nhóm 2 — HikariCP + Hibernate tuning
`backend/src/main/resources/application.yml`
- `spring.datasource.hikari`: maximum-pool-size 20, minimum-idle 5, connection-timeout 30000, idle-timeout 600000, max-lifetime 1800000.
- `spring.jpa.properties.hibernate`: bổ sung `jdbc.batch_size: 20`, `order_inserts: true`, `order_updates: true` (giữ nguyên dialect + format_sql sẵn có).

---

## Nhóm 3 — Backup scripts
- `D:\Pi-core\backup.bat` — Windows/Task Scheduler, mysqldump từ XAMPP, giữ 30 ngày (forfiles).
- `D:\Pi-core\backup.sh` — Linux/Docker, mysqldump, giữ 30 ngày (find -mtime +30).

---

## Ghi chú
- Chỉ một thay đổi ngoài phạm vi chỉ dẫn thuần: đổi signature `deleteExpense` + controller tương ứng (bắt buộc để truyền userId vào audit log).
- Toàn bộ dự án compile sạch, không lỗi.
