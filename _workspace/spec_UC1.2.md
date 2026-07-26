# Spec: UC1.2 — Quản lý tài khoản & phân quyền

## Thông tin chung
- **Route:** `/admin/accounts`
- **Vai trò:** ADMIN only
- **Giao diện:** Hình 14–22

---

## Luồng cơ bản

Hiển thị bảng tất cả tài khoản hệ thống (Hình 14):
- Cột: **Họ tên | Email | SĐT | Vai trò | Trạng thái | Thao tác**
- Pill vai trò (màu): Quản trị viên / Lễ tân / Huấn luyện viên / Hội viên
- Pill trạng thái: xanh lá "Hoạt động" / xám "Ngừng hoạt động"
- Thao tác: nút **"Sửa"** (cam `#F59E0B`) và **"Xóa"** (đỏ `#EF4444`)
- Nút **"+ Thêm tài khoản"** (teal)
- Ô tìm kiếm "Tìm theo tên, email..."

---

## Luồng phụ

### S-1 Thêm tài khoản (Hình 15)
Form modal/trang: **Họ tên(\*)**, **Email(\*)** (ghi chú: dùng làm tên đăng nhập), **Số điện thoại**, **Vai trò** (dropdown 4 lựa chọn), **Mật khẩu(\*)**, **Nhập lại mật khẩu(\*)**. Nút **"Lưu"**.

Validate:
- Trùng email → lỗi field=email **"Email đã tồn tại"** (Hình 17)
- Định dạng email sai → lỗi ngay dưới trường
- Mật khẩu < 8 ký tự → **"Mật khẩu phải có ít nhất 8 ký tự"**
- Nhập lại không khớp → **"Mật khẩu nhập lại không khớp"**
- Thiếu trường bắt buộc → highlight đỏ (Hình 16)
- Thành công: toast xanh, bảng tự reload

### S-2 Chỉnh sửa (Hình 19)
Form prefill dữ liệu hiện tại: Họ tên, Email (readonly — không được đổi), SĐT, Vai trò. **Không cho sửa mật khẩu ở form này.** Nút **"Cập nhật"**. Toast thành công.

### S-3 Vô hiệu hóa (Hình 20) — "Xóa" = soft delete
Nhấn "Xóa" → hộp thoại xác nhận **"Bạn có chắc muốn vô hiệu hóa tài khoản này?"** → xác nhận → set `status = INACTIVE` (soft delete, không xóa record). Pill đổi thành "Ngừng hoạt động".

### S-4 Tìm kiếm (Hình 21, 22)
Lọc real-time (hoặc on-submit) theo tên/email. Không có kết quả → **"Không tìm thấy tài khoản"**.

---

## API endpoints

```
GET  /accounts?search=...        → 200 List<AccountResponse>   (ADMIN)
POST /accounts                   → 201 AccountResponse          (ADMIN)
PUT  /accounts/{id}              → 200 AccountResponse          (ADMIN)
PATCH /accounts/{id}/status      → 200 AccountResponse          (ADMIN, toggle ACTIVE↔INACTIVE)
```

### AccountResponse (record)
```
Long id
String fullName
String email
String phone          (nullable)
String role           ("ADMIN" | "RECEPTIONIST" | "TRAINER" | "MEMBER")
String status         ("ACTIVE" | "INACTIVE")
LocalDateTime createdAt
```

### CreateAccountRequest (record)
```
@NotBlank String fullName
@NotBlank @Email String email
String phone
@NotNull String role   (phải là 1 trong 4 enum values)
@NotBlank @Size(min=8) String password
@NotBlank String confirmPassword
```

### UpdateAccountRequest (record)
```
@NotBlank String fullName
String phone
@NotNull String role
```
(email không được sửa)

---

## Data model

Dùng lại `UserAccount` entity đã có (`com.picore.auth.UserAccount`).

Cần tạo thêm **AuditLog** entity (bảng `audit_log`) dùng cho UC này và các UC sau:
```sql
audit_log(
  id BIGINT PK AUTO_INCREMENT,
  actor_id BIGINT NOT NULL,        -- user_account.id của người thực hiện
  action VARCHAR(50) NOT NULL,     -- CREATE_ACCOUNT, UPDATE_ACCOUNT, DEACTIVATE_ACCOUNT
  entity VARCHAR(50) NOT NULL,     -- "UserAccount"
  entity_id BIGINT,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## Business rules

1. **Email unique toàn hệ thống** — `user_account.email` là unique constraint → duplicate ném DataIntegrityViolationException → bắt và trả 400 field=email "Email đã tồn tại"
2. **Soft delete** — PATCH /accounts/{id}/status set status INACTIVE (không xóa record)
3. **Audit log** bắt buộc cho: tạo tài khoản (`CREATE_ACCOUNT`), sửa (`UPDATE_ACCOUNT`), vô hiệu hóa (`DEACTIVATE_ACCOUNT`) — actor_id lấy từ JWT (UserPrincipal)
4. Validate password ở service: `confirmPassword` phải khớp `password`, length ≥ 8
5. **Phân quyền:** chỉ ADMIN được gọi `/accounts/**` — `@PreAuthorize("hasRole('ADMIN')")`

---

## Mối liên hệ với UC khác

- Tài khoản hội viên (role=MEMBER) cũng được tạo tự động trong **UC2.1** — AccountService cần có method `createMemberAccount(email, fullName)` để UC2.1 dùng lại.
- HLV (role=TRAINER) được tạo ở UC1.2 trước, rồi UC4.3 thêm trainer_profile.

---

## Layout chung (UC1.2 là UC đầu tiên có authenticated layout)

UC1.2 phải tạo thêm các shared components dùng cho TẤT CẢ UC sau:

### `src/components/Layout.tsx`
Wrapper layout sau đăng nhập:
- Sidebar bên trái cố định (w-64)
- Phần nội dung bên phải: Header trắng + `<Outlet />` (nền `#F3F4F6`)
- Sidebar nền: `#0F3D3E`, chữ trắng, logo PiCore trên cùng

### `src/components/Sidebar.tsx`
Menu theo role (đọc từ `useAuthStore`):
- **ADMIN:** Tổng quan, Tài khoản (`/admin/accounts`), Hội viên, Gói tập, Lớp học, Điểm danh, Thiết bị, Tài chính
- **RECEPTIONIST:** Hội viên, Đăng ký gói, Lớp học, Điểm danh
- **TRAINER:** Lịch dạy
- **MEMBER:** Đặt lịch, Gói tập & Lịch sử
- "Đăng xuất" dưới cùng → `clearAuth()` + navigate `/login`
- Item active: nền sáng hơn `#134E4A` hoặc `bg-teal-700`

### `src/components/Header.tsx`
- Tiêu đề trang (prop `title`) bên trái, `font-semibold text-gray-800`
- Badge **"«Vai trò» – «Họ tên»"** bên phải (đọc từ authStore), nền teal nhạt

### `src/components/ProtectedRoute.tsx`
- Nếu chưa đăng nhập (`!isAuthenticated()`) → `<Navigate to="/login" />`
- Nếu có `allowedRoles` prop và role không khớp → `<Navigate to="/login" />` (hoặc trang 403 đơn giản)

### Cập nhật `App.tsx`
Bọc các route authenticated trong `<Layout />`:
```tsx
<Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
  <Route element={<Layout />}>
    <Route path="/admin/accounts" element={<AdminAccountsPage />} />
  </Route>
</Route>
```

---

## Design system (CLAUDE.md mục 6)

- Pill vai trò: bg màu khác nhau (ví dụ: Admin=teal, Lễ tân=blue, HLV=purple, Hội viên=green)
- Pill trạng thái: "Hoạt động" = `bg-green-100 text-green-700`; "Ngừng hoạt động" = `bg-gray-100 text-gray-500`
- Bảng: header `bg-gray-50 font-semibold`, hover `hover:bg-gray-50`, border kẻ mảnh
- Modal/Dialog dùng cho S-1 (form thêm) và S-3 (xác nhận xóa)

---

## Files backend cần tạo

```
backend/src/main/java/com/picore/auth/
├── AccountController.java
├── AccountService.java
└── dto/
    ├── AccountResponse.java      (record)
    ├── CreateAccountRequest.java (record)
    └── UpdateAccountRequest.java (record)

backend/src/main/java/com/picore/common/audit/
├── AuditLog.java                 (JPA entity — NO Lombok)
├── AuditLogRepository.java
└── AuditLogService.java
```

## Files frontend cần tạo

```
frontend/src/
├── components/
│   ├── Layout.tsx
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── ProtectedRoute.tsx
└── pages/admin/
    └── AdminAccountsPage.tsx
```

Cập nhật `App.tsx`: bọc admin routes trong Layout + ProtectedRoute.
