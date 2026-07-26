# Frontend UC5.3 — Điểm danh buổi học (DONE)

`npx tsc --noEmit` sạch, không lỗi type.

## Files tạo mới

| File | Vai trò |
|------|---------|
| `D:\Pi-core\frontend\src\api\attendance.ts` | Types + fetch functions cho attendance API |
| `D:\Pi-core\frontend\src\pages\reception\AttendancePage.tsx` | Trang chính `/reception/attendance` |
| `D:\Pi-core\frontend\src\pages\reception\QuickCheckinDialog.tsx` | Dialog điểm danh nhanh (walk-in) |

## Files sửa

| File | Thay đổi |
|------|----------|
| `D:\Pi-core\frontend\src\api\endpoints.ts` | Thêm `ATTENDANCE.ATTENDEES(id)` (các key khác đã có sẵn) |
| `D:\Pi-core\frontend\src\App.tsx` | Import `AttendancePage`, thay Placeholder `/reception/attendance` |

## Không cần sửa (đã có sẵn)

- `Sidebar.tsx` — RECEPTIONIST đã có `{ label: 'Điểm danh', path: '/reception/attendance' }` (dòng 26)
- `Layout.tsx` — đã có title `'/reception/attendance': 'Điểm danh'` (dòng 16)

## Quyết định UX quan trọng

1. **Layout 2 panel** (grid `lg:grid-cols-3`): panel trái 1/3 là danh sách card buổi học, panel phải 2/3 là bảng hội viên. Mobile (`< lg`) xếp dọc. Chọn cách này thay vì modal cho rõ ràng, thao tác nhanh.
2. **Quick-checkin 1 bước** (không preview): nhập SĐT → "Xác nhận điểm danh" → gọi `quickCheckin` → toast. Đúng theo hướng dẫn spec vì không có endpoint preview riêng (quick-checkin trừ buổi ngay). Toast hiển thị tên + số buổi còn lại (`∞` nếu null).
3. **Optimistic update**: sau check-in cập nhật `attendees` (status → ATTENDED) + tăng `checkedInCount` ở cả `sessions` và `selectedSession`. No-show chỉ đổi status (không đổi counter — spec đếm `checkedInCount` = số ATTENDED). Không refetch.
4. **Nút màu chuẩn spec**: "Có mặt" = `bg-[#22C55E]`, "No-show" = `bg-[#EF4444]`, nút teal header/dialog = `bg-teal-600`.
5. **Trạng thái không phải BOOKED**: ẩn 2 nút, hiển thị pill (xanh "Đã có mặt" / đỏ "No-show" / xám) + label "Đã xử lý" ở cột thao tác.
6. **`processingId`**: disable 2 nút của hàng đang gọi API để tránh double-click / double-count.
7. **Race prevention**: `let active = true` cho cả effect load sessions (mount) và effect load attendees (đổi `selectedSession`), cleanup set `active = false`.
8. **Header ngày**: format thủ công `"Thứ Sáu, 18/07/2026"` bằng bảng WEEKDAYS tiếng Việt (tránh phụ thuộc locale runtime).
9. Empty states: "Không có buổi học nào hôm nay", "Chọn một buổi học để xem danh sách hội viên", "Chưa có hội viên đăng ký cho buổi này".

## Lưu ý cho QA

- Các POST check-in/no-show gọi không body (`client.post(url)`), khớp backend.
- Lỗi 404/409/422/400 hiển thị qua `parseApiError` (dùng chung ErrorResponse dự án): check-in/no-show → toast; quick-checkin → hiện trong dialog.
- Walk-in (quick-checkin) không gắn buổi nào trong danh sách nên KHÔNG refetch attendees; counter buổi không đổi (đúng vì booking walk-in `classSessionId=null`).
- `sessionsRemaining === null` → `∞`; `packageTypeName === null` → `—`.
- Backend không đẩy realtime → mọi cập nhật counter là client-side; reload trang sẽ lấy số chuẩn từ server.
- Route bảo vệ bởi `ProtectedRoute allowedRoles={['RECEPTIONIST']}`.
