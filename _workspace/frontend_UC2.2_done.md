# UC2.2 — Gói tập & Lịch sử tập luyện (Frontend) — DONE

## Files đã tạo/sửa

### Tạo mới
- `src/api/me.ts` — 2 functions:
  - `fetchMyPackages()` → `MyPackageResponse[]`
  - `fetchMyHistory(filter, from?, to?)` → `MyHistoryItem[]` (chỉ gửi `from`/`to` khi `filter === 'CUSTOM'`)
  - Kèm types: `MyPackageResponse`, `MyPackageStatus`, `MyHistoryItem`, `HistoryFilter`, `AttendanceStatus`. Dùng lại `PackageCategory` từ `src/types`.
- `src/pages/member/MemberHistoryPage.tsx` — page component hoàn chỉnh (2 khối: Gói tập + Lịch sử).

### Sửa
- `src/App.tsx` — import `MemberHistoryPage`, thay Placeholder tại route `/member/history`.
- `src/components/Layout.tsx` — đổi tiêu đề Header `/member/history` thành "Gói tập & Lịch sử tập luyện" (theo spec; trước đó là "Gói tập & Lịch sử").

## Ghi chú quan trọng

### React Query KHÔNG được dùng (lệch so với đề bài)
- `@tanstack/react-query` **không** có trong `package.json` và **không** có `QueryClientProvider` trong `main.tsx`. Các trang `AccountsPage`/`MembersPage` mà đề bài dẫn chiếu thực tế **không** dùng `useQuery` — toàn bộ codebase dùng `useState` + `useEffect` + async loader (xem `AdminPackageTypesPage`, `AdminAccountsPage`).
- Vì đề bài yêu cầu "không cài thêm package", tôi theo đúng pattern hiện có: `useState`/`useEffect`. Nếu về sau muốn dùng React Query thật thì cần cài package + bọc provider ở `main.tsx` (thay đổi phạm vi lớn hơn UC này).

### State & filter logic (Khối 2 — Lịch sử)
- Có 2 state riêng: `filter` (điều khiển UI select/hiện input date) và `query` (`{filter, from?, to?}` — truy vấn thực tế đang áp dụng, mặc định `{filter: 'MONTH'}`).
- `useEffect` fetch lịch sử chạy theo `query`. WEEK/MONTH áp dụng **ngay** khi đổi select; CUSTOM chỉ áp dụng khi bấm nút **"Lọc"** (teal).
- Validate CUSTOM: bắt buộc cả 2 ngày, và `from <= to`, lỗi hiển thị đỏ dưới filter bar.
- `useEffect` history dùng cờ `active` để tránh race condition khi đổi filter nhanh.

### Format & hiển thị
- `formatDate`: "yyyy-MM-dd" → "dd/MM/yyyy". `formatTime`: cắt giây "HH:mm:ss" → "HH:mm", hiển thị "HH:mm – HH:mm".
- Gói theo buổi (`THEO_BUOI`/`GOI_1_1`/`GOI_1_2`) và `sessionsRemaining != null` → "Còn lại: X buổi"; còn lại → "Không giới hạn".
- Pill gói: ACTIVE "Đang hoạt động" (green-100/800), EXPIRED "Đã hết hạn" (gray-100/600), USED_UP "Hết buổi" (gray-100/600).
- Pill điểm danh: ATTENDED "Đã tập" (green-100/800), NO_SHOW "No-show" (red-100/700).
- `nearExpiry` → badge cam "⚠ Sắp hết" (`bg-amber-100 text-amber-700 border border-amber-300`).
- Empty states + error banner đỏ cho cả 2 khối; loading "Đang tải...".
- Cards gói: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`, card trắng `rounded-lg shadow p-4`.

### Kiểm tra
- `npx tsc --noEmit` pass sạch (không lỗi type).
- Trang này chỉ đọc dữ liệu (không có mutation) nên không cần Toast thành công.
