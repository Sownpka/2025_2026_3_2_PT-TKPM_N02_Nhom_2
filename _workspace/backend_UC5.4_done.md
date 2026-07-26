# Backend UC5.4 — Gửi thông báo nhắc lịch (DONE)

Trạng thái: `mvn clean compile` PASS (exit 0). `@EnableScheduling` đã có sẵn trong `PicoreApplication` — không cần thêm.

## Files tạo mới

| File | Vai trò |
|------|---------|
| `notification/NotificationLog.java` | JPA entity `notification_log` (id, memberId, channel, type, content, status, retryCount, sentAt) + 3 enum: `Channel{EMAIL,SMS}`, `NotificationType{CONFIRM,REMINDER,WAITLIST_INVITE,ACTIVATION}`, `NotificationStatus{SENT,FAILED}` |
| `notification/ScheduledNotification.java` | JPA entity `scheduled_notification` (id, bookingId, sendAt, sent) |
| `notification/NotificationLogRepository.java` | 4 query phân trang: `findByTypeAndStatus...`, `findByType...`, `findByStatus...`, `findAllByOrderBySentAtDesc` |
| `notification/ScheduledNotificationRepository.java` | `findBySendAtBeforeAndSentFalse(now)` |
| `notification/NotificationScheduler.java` | `@Component`, `@Scheduled(fixedDelay = 60_000)` quét hàng đợi, gửi reminder, set `sent=true` |
| `notification/dto/NotificationLogItem.java` | Java record cho response admin |
| `notification/NotificationController.java` | `GET /api/notifications`, `@PreAuthorize("hasRole('ADMIN')")` |

## Files sửa

| File | Thay đổi |
|------|----------|
| `notification/NotificationService.java` | Thêm method `void sendReminder(ScheduledNotification sn)` vào interface (giữ nguyên các method cũ) |
| `notification/MockNotificationService.java` | Rewrite từ log-thuần thành impl DB-backed: inject 6 repository, implement đầy đủ `sendBookingConfirmation` / `sendWaitlistInvite` / `sendReminder`, giữ `sendActivationEmail` / `sendPasswordResetEmail` / `sendBookingReminder` |

## Quyết định kỹ thuật quan trọng

1. **Không tạo class impl mới** — `NotificationService` vốn là interface và `MockNotificationService` (`@Primary @Service`) là impl duy nhất đang được `BookingService` inject qua interface. Logic UC5.4 được viết thẳng vào `MockNotificationService` để không phá vỡ wiring hiện có. Tên "Mock" giữ nguyên vì vẫn là mock (log console thay vì gửi email thật) đúng theo spec.

2. **`sendReminder(ScheduledNotification)`** được thêm vào interface (scheduler gọi qua interface `NotificationService`, không phụ thuộc class cụ thể). Method cũ `sendBookingReminder(memberId, bookingId)` được giữ và ủy quyền sang `sendReminder` để không phá caller cũ (nếu có).

3. **Exception được nuốt trong mọi method** của service (try-catch, không propagate) vì `BookingService.notifyQuietly()` chỉ bắt `RuntimeException` và lỗi thông báo tuyệt đối không được làm hỏng giao dịch đặt lịch. Khi load entity thất bại → log warning + ghi `NotificationLog` với `status=FAILED, retryCount=0`. `saveLog` cũng tự bọc try-catch để lỗi ghi log không leo ngược ra scheduler/booking.

4. **`send_at` đã qua vẫn tạo bản ghi** (buổi hôm nay sắp bắt đầu): scheduler nhặt tự nhiên ở lần quét kế và gửi ngay — đúng ghi chú spec.

5. **`sendAt = LocalDateTime.of(sessionDate, startTime).minusHours(2)`** — nhắc trước đúng 2 giờ.

6. **`resolveClassName`** theo pattern `BookingService`: có `gymClassId` → tên `GymClass`; nếu null → theo `SessionType` ("Buổi 1-1" / "Buổi 1-2" / "Buổi tập"). `resolveTrainerName` lấy `trainerProfile.userAccount.fullName`, fallback "N/A".

7. **Controller chọn repository theo null/non-null** của `type`/`status`. Tên hội viên batch-load qua `memberRepository.findAllById` (tránh N+1). Enum parse sai → `ApiException(400)` (đồng bộ với chuẩn lỗi toàn dự án thay vì `ResponseStatusException`).

## Nội dung thông báo (content templates)

- CONFIRM: `Xác nhận đặt lịch: {className} ngày {dd/MM/yyyy} lúc {HH:mm}, HLV: {trainerName}`
- WAITLIST_INVITE: `Có chỗ trống cho buổi {className} ngày {dd/MM/yyyy} lúc {HH:mm}. Đặt ngay!`
- REMINDER: `Nhắc lịch: {className} hôm nay lúc {HH:mm}, còn 2 giờ nữa`

## Lưu ý cho Frontend Dev

1. **Endpoint:** `GET /api/notifications?type=&status=&page=0&size=20` — **ADMIN only**. Gọi từ tài khoản không phải ADMIN sẽ bị 403.
2. **Response là `Page<NotificationLogItem>`** chuẩn Spring: `{ content: [...], totalElements, totalPages, number, size, ... }`. Dùng `content` để render bảng, `totalPages` cho pagination.
3. **Shape mỗi item:**
   ```
   { id, memberName, channel, type, content, status, retryCount, sentAt }
   ```
   - `memberName` có thể `null` (thông báo không gắn hội viên / hội viên đã xóa).
   - `sentAt` là ISO datetime string (ví dụ `2026-07-19T14:30:00`) hoặc `null`.
   - `channel`: `EMAIL` | `SMS` (hiện luôn `EMAIL`).
   - `type`: `CONFIRM` | `REMINDER` | `WAITLIST_INVITE` | `ACTIVATION`.
   - `status`: `SENT` | `FAILED`.
4. **Filter params optional** — bỏ trống (không gửi hoặc gửi rỗng) = lấy tất cả. Giá trị hợp lệ đúng tên enum viết HOA; giá trị sai → 400.
5. Hàng `status=FAILED` highlight đỏ nhạt; không có nút "Gửi lại" (đúng spec).

## Lưu ý cho QA

- `sendBookingConfirmation` ghi thật vào `notification_log` (type=CONFIRM) **và** tạo `scheduled_notification` (sendAt = giờ bắt đầu - 2h). Kiểm chứng bằng cách đặt 1 booking rồi query 2 bảng.
- Scheduler chạy mỗi 60s, no-op khi rỗng (đã guard `due.isEmpty()`), không ném exception ra ngoài.
- `/api/notifications` chỉ ADMIN (403 với role khác).
