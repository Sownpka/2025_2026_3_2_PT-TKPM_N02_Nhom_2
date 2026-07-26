# Spec UC5.4 — Gửi thông báo nhắc lịch

## Thông tin chung

- **UC ID:** UC5.4
- **Tên:** Gửi thông báo nhắc lịch (hệ thống tự động)
- **Actor:** HỆ THỐNG (kích hoạt từ UC5.1/UC5.2 sau đặt lịch thành công)
- **UI Admin:** `/admin/notifications` — Lịch sử thông báo (xem, không thao tác)
- **Màn hình tham chiếu:** Hình 72 (email xác nhận), Hình 73 (lịch sử thông báo admin)
- **Dependency:** UC5.1/UC5.2 (tạo booking), `notification_log`, `scheduled_notification` tables

---

## Luồng cơ bản

### Flow A — Xác nhận đặt lịch (ngay sau booking)

1. UC5.1/UC5.2 đặt lịch thành công → gọi `NotificationService.sendBookingConfirmation(memberId, bookingId)`
2. `NotificationService` (đã có stub từ UC5.1) thực hiện:
   - Tải thông tin booking + classSession + gymClass/trainer + member
   - Tạo nội dung thông báo: tên lớp/HLV, ngày, giờ, địa điểm
   - Ghi `notification_log` với type=CONFIRM, channel=EMAIL, status=SENT (hoặc FAILED)
   - Đồng thời: tạo `scheduled_notification` cho nhắc trước 2 giờ (send_at = sessionDateTime - 2h)
3. Dev: mock gửi bằng cách **log ra console + ghi notification_log** (không cần SendGrid thật)

### Flow B — Nhắc lịch trước 2 giờ (Spring Scheduler)

1. `@Scheduled(fixedDelay = 60000)` quét `scheduled_notification WHERE send_at <= now() AND sent = false`
2. Với mỗi bản ghi: gọi `NotificationService.sendReminder(scheduledNotification)`
3. Ghi `notification_log` type=REMINDER, channel=EMAIL
4. Đánh dấu `scheduled_notification.sent = true`

### E-1 — Gửi thất bại

- Mock dev: không thực sự fail, nhưng implement logic retry
- Ghi `notification_log.retry_count++`
- Sau 3 lần: `status = FAILED` — để lễ tân/admin theo dõi trong `/admin/notifications`

---

## UI Admin — `/admin/notifications` (Hình 73)

**Đơn giản — chỉ xem, không thao tác:**
- Tiêu đề: "Lịch sử thông báo"
- Bảng cột: **Thời gian | Hội viên | Loại | Kênh | Nội dung tóm tắt | Trạng thái**
- Lọc: dropdown Loại (CONFIRM/REMINDER/WAITLIST_INVITE/ACTIVATION) + dropdown Trạng thái (SENT/FAILED)
- Pagination hoặc "Xem thêm" (load 20 bản ghi / trang)
- Hàng status=FAILED: highlight đỏ nhạt
- Không có nút "Gửi lại" (theo spec)

---

## API Endpoints

```
GET /api/notifications?type=&status=&page=0&size=20
  - ADMIN only
  - Response: Page<NotificationLogItem> {
      content: Array<{
        id: number,
        memberName: string,
        channel: "EMAIL" | "SMS",
        type: "CONFIRM" | "REMINDER" | "WAITLIST_INVITE" | "ACTIVATION",
        content: string,         // nội dung tóm tắt (ví dụ: "Xác nhận đặt lịch Reformer Cơ bản 20/07/2026 07:00")
        status: "SENT" | "FAILED",
        retryCount: number,
        sentAt: string | null    // ISO datetime
      }>,
      totalElements: number,
      totalPages: number
    }
```

---

## Data model (đã có trong schema)

```sql
notification_log(id, member_id FK, channel ENUM(EMAIL,SMS), type ENUM(CONFIRM,REMINDER,WAITLIST_INVITE,ACTIVATION), content, status ENUM(SENT,FAILED), retry_count, sent_at)
scheduled_notification(id, booking_id FK, send_at, sent BOOL)
```

Cả 2 bảng đã khai báo trong CLAUDE.md mục 7. Cần:
1. Tạo JPA Entity cho `notification_log` và `scheduled_notification`
2. Tạo Repository tương ứng
3. Implement `NotificationService` (hiện là mock stub)

---

## Implement NotificationService

`NotificationService` hiện có stub từ UC5.1. Implement đầy đủ:

```java
// Đã có (stub):
void sendBookingConfirmation(Long memberId, Long bookingId)
void sendWaitlistInvite(Long memberId, Long classSessionId)

// Cần implement thêm:
void sendReminder(ScheduledNotification sn)
void sendActivationEmail(Long memberId, String tempPassword)  // dùng cho UC2.1
```

**Nội dung thông báo (template đơn giản — mock):**
- CONFIRM: `"Xác nhận đặt lịch: {className} ngày {date} lúc {time}, HLV: {trainerName}"`
- REMINDER: `"Nhắc lịch: {className} hôm nay lúc {time}, còn 2 giờ nữa"`
- WAITLIST_INVITE: `"Có chỗ trống cho buổi {className} ngày {date} lúc {time}. Đặt ngay trước khi hết!"`

---

## Scheduler

```java
@Component
public class NotificationScheduler {
    @Scheduled(fixedDelay = 60_000)  // mỗi 60 giây
    public void processScheduledNotifications() { ... }
}
```

Cần `@EnableScheduling` trong main class hoặc config. Kiểm tra xem đã có chưa.

---

## Notes cho Backend Dev

1. **NotificationLog entity**: `id, memberId, channel(ENUM), type(ENUM), content, status(ENUM), retryCount, sentAt`
2. **ScheduledNotification entity**: `id, bookingId, sendAt(LocalDateTime), sent(boolean)`
3. `NotificationService.sendBookingConfirmation`:
   - Load booking → classSession → gymClass (nếu có) → trainerProfile → member
   - Build content string
   - Log ra console: `log.info("[NOTIFY] Gửi xác nhận tới memberId={}: {}", memberId, content)`
   - Lưu `notification_log` với status=SENT
   - Tạo `scheduled_notification` với `send_at = classSession.sessionDate + classSession.startTime - 2h`
4. `NotificationScheduler`: quét `scheduled_notification WHERE send_at <= now() AND sent=false`
5. Implement `GET /api/notifications` với `@PreAuthorize("hasRole('ADMIN')")`
6. Đảm bảo `@EnableScheduling` ở config/main

## Notes cho Frontend Dev

1. Route `/admin/notifications` đang là Placeholder → thay bằng `NotificationsPage`
2. Sidebar ADMIN cần entry "Thông báo" → `/admin/notifications` (kiểm tra đã có chưa)
3. Layout title: "Lịch sử thông báo"
4. Dùng Page `content` array, hiển thị pagination đơn giản
5. Pills: SENT → xanh, FAILED → đỏ; CONFIRM → xanh dương, REMINDER → vàng, v.v.
6. Filter: 2 dropdown (Loại + Trạng thái), change → re-fetch với params mới

## Notes cho QA

- Verify `NotificationService.sendBookingConfirmation` thực sự ghi `notification_log` (không chỉ log console)
- Verify `ScheduledNotification` được tạo khi booking (send_at = sessionDate+startTime - 2h)
- Verify scheduler không throw exception khi không có bản ghi
- Verify API `/api/notifications` chỉ ADMIN access
- Verify frontend pagination (`totalPages`) render đúng
- Verify filter params truyền xuống API call
