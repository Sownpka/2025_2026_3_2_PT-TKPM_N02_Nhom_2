## Frontend done: UC1.2 — Quản lý tài khoản & phân quyền + Shared Layout

### Files created
- `src/api/accounts.ts` — API layer: `getAccounts(search?)`, `createAccount`, `updateAccount`, `toggleAccountStatus`; types `CreateAccountPayload`, `UpdateAccountPayload`.
- `src/components/ProtectedRoute.tsx` — guard route theo `allowedRoles?: Role[]`; chưa auth hoặc sai role → `<Navigate to="/login" replace />`, ngược lại `<Outlet />`.
- `src/components/Sidebar.tsx` — sidebar w-64 nền `#0F3D3E`, logo PiCore, menu theo role (ADMIN/RECEPTIONIST/TRAINER/MEMBER), active `bg-[#134E4A]` + border-left teal, nút Đăng xuất (`clearAuth()` + navigate `/login`).
- `src/components/Header.tsx` — prop `title`, badge "«RoleLabel» – «fullName»" (Admin/Lễ tân/Huấn luyện viên/Hội viên) nền teal nhạt.
- `src/components/Layout.tsx` — `flex h-screen`, Sidebar + Header + `<main>` với `<Outlet />`; map pathname → title qua `PAGE_TITLES` (đã seed các route hiện có, thêm dần theo UC).
- `src/components/Toast.tsx` — toast xanh góc phải, tự đóng sau 3s.
- `src/pages/admin/AdminAccountsPage.tsx` — trang chính UC1.2.

### Files modified
- `src/types/index.ts` — thêm `AccountResponse` (dùng `Role`, `Status` sẵn có).
- `src/App.tsx` — chuyển sang nested routes: public (`/login`, `/forgot-password`, `/reset-password`) giữ nguyên; tất cả route authenticated bọc trong `ProtectedRoute` (theo role) → `Layout`. `/admin/accounts` trỏ `AdminAccountsPage`, các route còn lại là `Placeholder` trong Layout.

### AdminAccountsPage — tính năng
- Toolbar: ô tìm kiếm "Tìm theo tên, email..." (debounce 300ms → `getAccounts(search)`) + nút "+ Thêm tài khoản".
- Bảng: Họ tên | Email | SĐT | Vai trò | Trạng thái | Thao tác. Empty → "Không tìm thấy tài khoản".
- `RolePill`: ADMIN teal "Quản trị viên", RECEPTIONIST blue "Lễ tân", TRAINER purple "Huấn luyện viên", MEMBER green "Hội viên".
- `StatusPill`: ACTIVE green "Hoạt động", INACTIVE gray "Ngừng hoạt động".
- Nút "Sửa" (`#F59E0B`), "Xóa" (`#EF4444`, disable khi đã INACTIVE).
- Modal Thêm: Họ tên*, Email* (hint "Dùng làm tên đăng nhập"), SĐT, Vai trò (dropdown 4), Mật khẩu*, Nhập lại*; nút "Lưu".
- Modal Sửa: prefill; Email readonly (nền xám); không có trường mật khẩu; nút "Cập nhật".
- Lỗi field-level: border đỏ + text đỏ dưới input; lỗi chung: banner đỏ đầu form. Xử lý cả 2 shape backend qua `parseApiError` (field → map theo `field`, còn lại → banner).
- ConfirmDialog "Bạn có chắc muốn vô hiệu hóa tài khoản này?" → "Xác nhận" (đỏ) / "Hủy".
- Sau thêm/sửa/xóa thành công: đóng modal + reload danh sách + toast xanh 3s.

### Types defined
- `AccountResponse` (types/index.ts): `{ id, fullName, email, phone: string|null, role: Role, status: Status, createdAt: string }`.
- `CreateAccountPayload` / `UpdateAccountPayload` (api/accounts.ts).

### Routes added / restructured
- ADMIN: `/admin/accounts` (implemented), `/admin/dashboard`, `/admin/members`, `/admin/package-types`, `/admin/classes`, `/admin/attendance`, `/admin/equipment`, `/admin/trainers`, `/admin/notifications`, `/admin/finance` (Placeholder trong Layout).
- RECEPTIONIST: `/reception/members`, `/reception/register-package`, `/reception/attendance`.
- MEMBER: `/member/history`, `/member/booking`, `/member/private-booking`.
- TRAINER: `/trainer/schedule`.
- Tất cả bọc trong `ProtectedRoute allowedRoles` tương ứng + `Layout`.

### Verify
- `npx tsc --noEmit` → EXIT 0 (TypeScript strict, không dùng `any`).

### Issues / lưu ý
- Endpoint dùng `ACCOUNTS` từ `endpoints.ts` (base `/accounts`), axios client baseURL `/api` → khớp contract `/api/accounts`.
- `toggleAccountStatus` gọi PATCH không body; backend toggle ACTIVE↔INACTIVE. Nút "Xóa" chỉ hiển thị cho account ACTIVE (disable khi INACTIVE) vì spec mô tả luồng "vô hiệu hóa"; nếu cần reactivate từ UI thì mở lại nút cho INACTIVE sau.
- Sidebar menu ADMIN gồm mục "Tổng quan"→`/admin/dashboard` và "Điểm danh"→`/admin/attendance`: đã thêm Placeholder route để không vỡ điều hướng.
- Title trang lấy từ `PAGE_TITLES` theo pathname trong Layout; UC sau chỉ cần thêm entry.
- Chưa có test tự động (không trong scope). Chưa chạy `vite build` production (chỉ typecheck).
