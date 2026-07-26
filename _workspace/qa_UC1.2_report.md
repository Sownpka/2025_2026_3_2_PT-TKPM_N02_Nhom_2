## QA Report: UC1.2 — Quản lý tài khoản

### Status: PASS

Tích hợp backend ↔ frontend khớp trên toàn bộ contract bắt buộc. Không có lỗi chặn (blocker). Chỉ tồn tại vài điểm UX/nhất quán mức thấp, không ảnh hưởng luồng chính.

### Issues found
| # | Severity | File:Line | Description | Fix suggestion |
|---|----------|-----------|-------------|----------------|
| 1 | Low (UX) | frontend/src/pages/admin/AdminAccountsPage.tsx:272-279 | Nút "Xóa" bị `disabled` khi account INACTIVE. Backend `toggleStatus` hỗ trợ cả ACTIVATE (INACTIVE→ACTIVE) nhưng UI không có cách kích hoạt lại tài khoản đã vô hiệu hóa. | Thêm nút "Kích hoạt" cho account INACTIVE (gọi cùng `toggleAccountStatus`), hoặc đổi nhãn nút theo status. Đã ghi chú trong frontend_done. |
| 2 | Low (nhất quán nhãn) | frontend/src/components/Header.tsx:9 | Header hiển thị vai trò ADMIN là "Admin", trong khi RolePill ở bảng dùng "Quản trị viên". Không sai theo checklist (badge = RoleLabel) nhưng thiếu nhất quán. | Đổi `ADMIN: 'Admin'` → `'Quản trị viên'` cho khớp toàn app (nếu muốn). |
| 3 | Low (auth edge) | backend/.../GlobalExceptionHandler.java:30-34 | `@ExceptionHandler(Exception.class)` catch-all có thể bắt `AccessDeniedException` từ `@PreAuthorize` và trả 500 thay vì 403. Frontend không trigger được (ProtectedRoute chặn trước) nên không ảnh hưởng UC1.2. | Thêm `@ExceptionHandler(AccessDeniedException.class)` trả 403 để chuẩn hóa. Ngoài scope UC1.2. |

### Passed checks

**Shape alignment**
- `AccountResponse` record (id Long, fullName, email, phone, role String, status String, createdAt String) khớp 1:1 interface `AccountResponse` trong types/index.ts (id number, phone `string|null`, role `Role`, status `Status`, createdAt string).
- `role`/`status` trả về qua `.name()` = "ADMIN"/"RECEPTIONIST"/... và "ACTIVE"/"INACTIVE"; frontend types `Role`/`Status` union đúng các giá trị này; RolePill/StatusPill map đủ 4 role + 2 status.
- `phone` nullable: bảng render `acc.phone ?? '—'`, edit form `account.phone ?? ''`, type `string | null` — handle null đúng.
- `CreateAccountPayload` {fullName, email, phone?, role, password, confirmPassword} khớp `CreateAccountRequest`. `phone: form.phone || undefined` (bỏ trống → không gửi) — hợp lệ vì backend phone không @NotBlank.
- `UpdateAccountPayload` {fullName, phone?, role} khớp `UpdateAccountRequest`; email KHÔNG gửi (form email readOnly khi edit, không đưa vào PUT body). Đúng.
- PATCH `/accounts/{id}/status`: `toggleAccountStatus` gọi `client.patch(STATUS(id))` không body; backend `@PatchMapping("/{id}/status")` không `@RequestBody`. Đúng.
- Endpoints: `ACCOUNTS.BASE=/accounts`, `BY_ID`, `STATUS` khớp routes controller (`@RequestMapping("/accounts")`). Search param `?search=` khớp `@RequestParam(required=false)`.

**Error contract**
- Lỗi nghiệp vụ có field → `{field, message}` (object); lỗi chung → `{message}`; lỗi validation → `[{field, message}]` (array). `parseApiError` xử lý đủ cả 3 shape; `applyErrors` map field-level vào input + general vào banner. Khớp hoàn toàn.

**Business rules**
- Soft delete: `toggleStatus` chỉ đổi ACTIVE↔INACTIVE, không xóa record. Đúng.
- Audit log ghi cho CREATE_ACCOUNT / UPDATE_ACCOUNT / DEACTIVATE_ACCOUNT / ACTIVATE_ACCOUNT, actorId lấy từ `UserPrincipal.id()` qua JWT. Đúng.
- Email unique: `existsByEmail` + bắt `DataIntegrityViolationException` (dùng `saveAndFlush`) chống race. Đúng.
- Validate: confirmPassword khớp, password ≥ 8 ký tự, role parse hợp lệ — đủ.
- `@PreAuthorize("hasRole('ADMIN')")` ở class-level AccountController; `@EnableMethodSecurity` bật trong SecurityConfig; `UserPrincipal.getAuthorities()` trả `ROLE_<role>` → `hasRole('ADMIN')` khớp `ROLE_ADMIN`. Đúng.
- ProtectedRoute: chưa auth → `/login`; sai role → `/login`; `/admin/accounts` bọc `allowedRoles={['ADMIN']}`. Đúng.

**Vietnamese labels (AdminAccountsPage.tsx)**
- Header bảng: "Họ tên", "Email", "SĐT", "Vai trò", "Trạng thái", "Thao tác" — đủ.
- Nút "Sửa" (#F59E0B), "Xóa" (#EF4444, disable khi INACTIVE) — đúng.
- "+ Thêm tài khoản", "Lưu" (create) / "Cập nhật" (edit), "Hủy" — đúng.
- Confirm: "Bạn có chắc muốn vô hiệu hóa tài khoản này?" — đúng.
- Empty state: "Không tìm thấy tài khoản" — đúng.
- RolePill: "Quản trị viên" / "Lễ tân" / "Huấn luyện viên" / "Hội viên" — đủ.
- StatusPill: "Hoạt động" / "Ngừng hoạt động" — đúng.

**Layout / routing**
- Layout: `flex h-screen` → Sidebar + (Header + `<main><Outlet/></main>`). Đúng cấu trúc.
- Sidebar ADMIN đủ 8 mục: Tổng quan, Tài khoản, Hội viên, Gói tập, Lớp học, Điểm danh, Thiết bị, Tài chính.
- Header badge: `«ROLE_LABEL» – «fullName»` (từ authStore). Đúng khuôn.
- App.tsx: `/admin/accounts` → `ProtectedRoute allowedRoles={['ADMIN']}` → `Layout` → `AdminAccountsPage`. Đúng.

### Recommendations
- Xử lý Issue #1 sớm nếu spec yêu cầu kích hoạt lại tài khoản đã vô hiệu hóa (hiện chỉ vô hiệu hóa được một chiều từ UI).
- Cân nhắc đồng bộ nhãn ADMIN giữa Header ("Admin") và RolePill ("Quản trị viên") — Issue #2.
- Sidebar ADMIN không có mục cho routes `/admin/trainers` và `/admin/notifications` (chỉ truy cập trực tiếp bằng URL). Không thuộc UC1.2 nhưng nên bổ sung khi làm UC4.3 / UC5.4.
- Backend: thêm handler riêng cho `AccessDeniedException` (Issue #3) khi làm phần hardening bảo mật.
- Cả 2 phía đã pass compile/typecheck (`mvn compile` exit 0, `tsc --noEmit` exit 0); chưa có test tự động — nên bổ sung integration test cho AccountController + component test cho AdminAccountsPage ở giai đoạn sau.
