# QA Report — UC5.4

## Kết quả: PASS

Tích hợp backend ↔ frontend cho UC5.4 (Gửi thông báo nhắc lịch) khớp đầy đủ. Không phát hiện lỗi chặn (ERROR). Có 2 điểm mức WARNING (không ảnh hưởng chức năng thực tế).

## API Shape: OK

`NotificationLogItem` (record, `dto/NotificationLogItem.java`) khớp interface TS (`api/notifications.ts`):

| Field | Backend | Frontend | Kết quả |
|-------|---------|----------|---------|
| id | `Long` | `number` | OK |
| memberName | `String` (nullable, controller trả null khi memberId null / không tìm thấy) | `string \| null` | OK |
| channel | `String` = `channel.name()` (EMAIL/SMS) | `'EMAIL' \| 'SMS'` | OK |
| type | `String` = `type.name()` | `'CONFIRM' \| 'REMINDER' \| 'WAITLIST_INVITE' \| 'ACTIVATION'` | OK |
| content | `String` | `string` | OK |
| status | `String` = `status.name()` | `'SENT' \| 'FAILED'` | OK |
| retryCount | `int` | `number` | OK |
| sentAt | `String` = `LocalDateTime.toString()` (ISO, nullable) | `string \| null` | OK |

Response bọc `Page<NotificationLogItem>` chuẩn Spring; FE `NotificationPage` dùng `content`, `totalPages`, `totalElements`, `number` — khớp.

## Endpoint match: OK
- Controller `@RequestMapping("/api/notifications")` + `@GetMapping`. FE `NOTIFICATIONS.BASE = '/notifications'`, axios baseURL `/api` → URL cuối `/api/notifications`. Khớp.
- Query params: BE `@RequestParam` tên `type`, `status`, `page`, `size`; FE gửi đúng 4 tên đó. Khớp.

## Business Rules: OK

- **BR-1 OK** — `sendBookingConfirmation` (MockNotificationService:78-115) ghi `NotificationLog` type=CONFIRM, status=SENT (saveLog:96-97) VÀ tạo `ScheduledNotification` với `sendAt = LocalDateTime.of(sessionDate, startTime).minusHours(2)` (dòng 101-107). Đúng "trước 2 giờ".
- **BR-2 OK** — `NotificationScheduler.processScheduledNotifications` (scheduler:32-48) quét `findBySendAtBeforeAndSentFalse(now)`, guard `if (due.isEmpty()) return;` (dòng 35-37) → không throw khi rỗng. Gọi `sendReminder`, set `sent=true`, save; mỗi vòng lặp bọc try/catch riêng.
- **BR-3 OK** — Grep toàn `com.picore.attendance` không có tham chiếu notification/scheduled/reminder nào; `notificationService` chỉ được gọi ở BookingService (confirm + waitlist), PrivateBookingService (confirm), MemberService (activation), AuthService (reset). Check-in / no-show KHÔNG tạo ScheduledNotification. MockNotificationService cũng không có method check-in.
- **BR-4 OK** — `sendReminder` (MockNotificationService:162-190) ghi `NotificationLog` type=REMINDER (saveLog:181).

## Security: OK
- `NotificationController` có `@PreAuthorize("hasRole('ADMIN')")` cấp class (dòng 28).
- `SecurityConfig` có `@EnableMethodSecurity` (dòng 22) → `@PreAuthorize` thực sự có hiệu lực (không bị bỏ qua âm thầm).
- FE: route `/admin/notifications` nằm trong `<ProtectedRoute allowedRoles={['ADMIN']}>` (App.tsx:46-64).

## Routing: OK
- App.tsx:12 import `NotificationsPage`; App.tsx:64 route render `<NotificationsPage />` (không còn Placeholder).
- Sidebar.tsx:20 — menu ADMIN có `{ label: 'Thông báo', path: '/admin/notifications' }` (sau "Huấn luyện viên", trước "Tài chính").
- Layout.tsx:13 — title map `'/admin/notifications': 'Lịch sử thông báo'`.

## UX/Labels: OK
- Pill type (NotificationsPage:14-19): CONFIRM = `bg-blue-100` (xanh dương), REMINDER = `bg-yellow-100` (vàng), WAITLIST_INVITE = `bg-purple-100` (tím), ACTIVATION = `bg-gray-100` (xám). Đúng.
- Pill status (22-25): SENT = `bg-green-100` (xanh lá), FAILED = `bg-red-100` (đỏ). Đúng.
- Hàng FAILED: `className={isFailed ? 'bg-red-50' : ...}` (dòng 186). Đúng.
- `sentAt` null → `formatSentAt` trả "—" (dòng 50). `memberName` null → `n.memberName ?? '—'` (dòng 192). Đúng.
- Empty state (dòng 226-227): "Chưa có thông báo nào được ghi nhận". Đúng.
- Pagination: `showPagination = totalPages > 1` (dòng 108); chỉ render khi true (dòng 234). Đúng. Nút Trước/Sau disable ở biên và khi loading.
- Bảng cột: Thời gian | Hội viên | Loại | Kênh | Nội dung | Trạng thái — khớp spec.

## Filter params: OK
- `notifications.ts:44-48`: `if (params.type) query.type = ...` / `if (params.status) query.status = ...` → chuỗi rỗng falsy nên không gửi param.
- NotificationsPage:76-77 truyền `type: filterType || undefined`, `status: filterStatus || undefined` → khi filter = '' không gửi.
- BE `parseType/parseStatus` (Controller:90-110): null/blank → null → nhánh `findAllByOrderBySentAtDesc`. Giá trị enum sai → `ApiException(400)`. Đổi filter reset `page=0` (handleTypeChange/handleStatusChange). Đúng.

## Issues

- `NotificationsPage.tsx:211` — WARNING — `statusPill.className` / `statusPill.label` truy cập không có optional chaining (khác với `typePill?.` ở dòng 197). Nếu `status` trả về giá trị ngoài enum SENT/FAILED sẽ crash render. Thực tế BE luôn trả đúng enum nên không xảy ra; nên đồng bộ dùng `?.` cho nhất quán.
- `api/notifications.ts:16-22` — WARNING — FE khai báo `channel/type/status` non-nullable, nhưng controller (`toItem`, Controller:82-85) về mặt kỹ thuật có thể trả `null` nếu cột enum trong DB null. Dữ liệu do service ghi luôn set đủ 3 trường (saveLog:223-225) nên không phát sinh; chỉ là mismatch lý thuyết về nullability.

## Kết luận

PASS. UC5.4 tích hợp đúng spec: API shape khớp 1-1, endpoint và query param trùng tên, 4 business rule (BR-1..BR-4) đều đạt, bảo mật ADMIN có hiệu lực cả BE (`@PreAuthorize` + `@EnableMethodSecurity`) lẫn FE (`ProtectedRoute`), routing/sidebar/title đầy đủ, UX nhãn/pill/màu/empty/pagination/filter đúng yêu cầu. Backend `mvn clean compile` PASS, frontend `tsc --noEmit` PASS. Hai điểm WARNING chỉ mang tính phòng thủ, không chặn nghiệm thu.
