# Frontend UC5.4 — Lịch sử thông báo admin (DONE)

Trạng thái: `npx tsc --noEmit` PASS (exit 0, không lỗi type).

## Files tạo mới

| File | Vai trò |
|------|---------|
| `src/api/notifications.ts` | Types (`NotificationLogItem`, `NotificationPage`, enum channel/type/status) + `fetchNotifications(params)` gọi `GET /api/notifications`, bỏ qua param empty/undefined |
| `src/pages/admin/NotificationsPage.tsx` | Trang lịch sử thông báo: filter Loại + Trạng thái, bảng, pagination |

## Files sửa

| File | Thay đổi |
|------|----------|
| `src/App.tsx` | Import `NotificationsPage`; thay Placeholder route `/admin/notifications` bằng `<NotificationsPage />` (vẫn trong nhóm ADMIN-only) |
| `src/components/Sidebar.tsx` | Thêm entry ADMIN `{ label: 'Thông báo', path: '/admin/notifications' }` (sau "Huấn luyện viên", trước "Tài chính") |
| `src/components/Layout.tsx` | Thêm title map `'/admin/notifications': 'Lịch sử thông báo'` |

## Ghi chú kỹ thuật

- `src/api/endpoints.ts` đã có sẵn `NOTIFICATIONS.BASE = '/notifications'` — dùng lại, không thêm mới. Client axios baseURL đã là `/api` nên URL cuối là `/api/notifications`.
- Dùng `parseApiError(err)[0].message` (chuẩn dự án, giống AttendancePage) thay vì `err.message` để hiển thị lỗi thân thiện.
- Active-flag pattern chống race: re-fetch khi `filterType | filterStatus | page` đổi; cleanup set `active = false`.
- Đổi filter (Loại hoặc Trạng thái) → reset `page = 0`.
- `size = 20` (PAGE_SIZE).

## Mapping hiển thị

- Type: CONFIRM → pill xanh dương "Xác nhận đặt lịch"; REMINDER → pill vàng "Nhắc lịch"; WAITLIST_INVITE → pill tím "Mời từ DS chờ"; ACTIVATION → pill xám "Kích hoạt TK".
- Status: SENT → pill xanh lá "Đã gửi"; FAILED → pill đỏ "Thất bại".
- Channel: EMAIL → "Email"; SMS → "SMS".
- Hàng FAILED: `bg-red-50` (đỏ rất nhạt).
- `sentAt` null → "—"; format khác: `dd/MM/yyyy HH:mm`.
- `memberName` null → "—".
- Empty state: "Chưa có thông báo nào được ghi nhận".
- Pagination chỉ hiển thị khi `totalPages > 1`; nút Trước/Sau disable ở biên và khi đang tải.

## Lưu ý cho QA

1. Trang chỉ ADMIN. Đăng nhập tài khoản không phải ADMIN → API 403 → hiển thị dòng lỗi đỏ (không phá trang).
2. Verify filter Loại + Trạng thái truyền đúng query param (`?type=&status=`), giá trị enum viết HOA. Bỏ trống = tất cả.
3. Verify đổi filter reset về Trang 1; pagination render đúng "Trang X / Y".
4. Verify hàng FAILED nền đỏ nhạt; các pill màu đúng mapping.
5. Verify `sentAt`/`memberName` null hiển thị "—".
6. Không có nút "Gửi lại" (đúng spec — chỉ xem).
7. Menu Sidebar ADMIN có mục "Thông báo"; header hiển thị "Lịch sử thông báo".
