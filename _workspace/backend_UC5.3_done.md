# Backend UC5.3 — Điểm danh buổi học (DONE)

Module `com.picore.attendance`. Compile sạch (`mvn clean compile` → BUILD SUCCESS, 106 files).

## Files tạo mới

| File | Vai trò |
|------|---------|
| `D:\Pi-core\backend\src\main\java\com\picore\attendance\dto\SessionSummary.java` | DTO buổi học trong "Điểm danh hôm nay" |
| `D:\Pi-core\backend\src\main\java\com\picore\attendance\dto\AttendeeItem.java` | DTO 1 hội viên trong buổi |
| `D:\Pi-core\backend\src\main\java\com\picore\attendance\dto\CheckInResponse.java` | Kết quả check-in / no-show |
| `D:\Pi-core\backend\src\main\java\com\picore\attendance\dto\QuickCheckinRequest.java` | Body điểm danh nhanh |
| `D:\Pi-core\backend\src\main\java\com\picore\attendance\dto\QuickCheckinResponse.java` | Kết quả điểm danh nhanh |
| `D:\Pi-core\backend\src\main\java\com\picore\attendance\AttendanceService.java` | Nghiệp vụ UC5.3 |
| `D:\Pi-core\backend\src\main\java\com\picore\attendance\AttendanceController.java` | REST endpoints |

## Files sửa

| File | Thay đổi |
|------|----------|
| `D:\Pi-core\backend\src\main\java\com\picore\booking\Booking.java` | `class_session_id` đổi sang **nullable** (bỏ `nullable=false`) để hỗ trợ walk-in |
| `D:\Pi-core\backend\src\main\java\com\picore\clazz\ClassSessionRepository.java` | Thêm `findBySessionDateOrderByStartTimeAsc(LocalDate)` |
| `D:\Pi-core\backend\src\main\java\com\picore\booking\BookingRepository.java` | Thêm `findByClassSessionIdAndStatusIn(Long, List<BookingStatus>)` |

## Endpoints (base `/api/attendance`, tất cả `hasRole('RECEPTIONIST')`)

- `GET  /api/attendance/today` → `List<SessionSummary>`
- `GET  /api/attendance/{sessionId}/attendees` → `List<AttendeeItem>` (404 nếu sessionId sai)
- `POST /api/attendance/{bookingId}/check-in` → `CheckInResponse` (409 nếu không còn BOOKED)
- `POST /api/attendance/{bookingId}/no-show` → `CheckInResponse` (409 nếu không còn BOOKED)
- `POST /api/attendance/quick-checkin` body `{ "phone": "..." }` → `QuickCheckinResponse`

## Quyết định kỹ thuật quan trọng

1. **Quick-checkin & nullable `class_session_id`** — Booking entity KHÔNG có FK constraint thật
   (chỉ là cột `Long`, không `@ManyToOne`/`@JoinColumn`). Bảng `booking` cũng KHÔNG có file
   migration SQL — schema do Hibernate `ddl-auto` sinh (dev: `create-drop`, prod: `validate`).
   Vì vậy chỉ cần đổi annotation cột sang nullable là an toàn tuyệt đối, không phá schema,
   không cần magic number `-1` hay session ad-hoc. Booking walk-in lưu `classSessionId = null`,
   `status = ATTENDED`, `checkedInAt = now()`.
   - **Lưu ý prod**: khi bật `validate` với schema tạo tay, cột `booking.class_session_id`
     phải để `NULL` (không `NOT NULL`). Hiện chưa có DDL booking nên chưa ảnh hưởng.

2. **Chọn gói ACTIVE cho walk-in** — không dùng `findFirst...OrderByEndDateDesc` (có thể chọn
   trúng gói đã hết buổi). Thay vào đó duyệt toàn bộ gói của hội viên, lọc
   `status=ACTIVE AND endDate>=today AND (sessionsRemaining==null || >0)`, ưu tiên gói mới nhất
   theo start_date. Trừ 1 buổi chỉ với gói giới hạn (sessionsRemaining != null).

3. **bookedCount / checkedInCount** — batch-load 1 lần toàn bộ booking chiếm chỗ (BOOKED +
   ATTENDED + NO_SHOW) của mọi buổi trong ngày rồi group in-memory (tránh N+1). `bookedCount`
   = tổng 3 trạng thái đó; `checkedInCount` = số ATTENDED.

4. **Check-in / No-show** chỉ chuyển từ BOOKED. Nếu đã ATTENDED/NO_SHOW → `409 "Hội viên này
   đã được xử lý điểm danh"`. No-show KHÔNG hoàn buổi (BR 5.2). Check-in KHÔNG trừ buổi lần 2.

5. **Sort attendees**: BOOKED (chưa xử lý) lên đầu, ATTENDED/NO_SHOW xuống dưới. Bỏ CANCELLED.

## Lưu ý cho Frontend Dev

- Response `SessionSummary.startTime/endTime` là **string `"HH:mm"`** (đã format sẵn), không phải object.
- `AttendeeItem.packageTypeName` và `sessionsRemaining` có thể **null** (gói không giới hạn hoặc
  booking không gắn gói) → hiển thị `∞` hoặc `—`.
- `CheckInResponse.checkedInAt` **null** với no-show.
- Mã lỗi: 404 (không thấy hội viên / buổi), 409 (đã xử lý điểm danh), 422 (không có gói còn hiệu lực),
  400 (thiếu SĐT). Body lỗi theo `ErrorResponse` chung của dự án.
- Sau check-in/no-show, FE tự cập nhật counter "x/y" (backend không đẩy realtime).
- Quick-checkin trả về `sessionsRemaining` là số **sau khi đã trừ 1 buổi**.
