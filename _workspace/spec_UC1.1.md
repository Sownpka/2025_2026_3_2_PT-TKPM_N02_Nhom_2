# Spec: UC1.1 — Đăng nhập

## Thông tin chung
- **Route:** `/login`
- **Vai trò:** tất cả (public — chưa đăng nhập)
- **Giao diện:** Hình 9–13 trong đặc tả

---

## Luồng cơ bản

1. Người dùng mở `/login`
2. Nhập **Email** + **Mật khẩu**
3. Nhấn **"Đăng nhập"**
4. Backend kiểm tra: tài khoản tồn tại → không bị khóa → mật khẩu đúng
5. Tạo JWT, trả về token + role + fullName + userId
6. Frontend lưu vào Zustand store (persist), redirect theo vai trò:
   - ADMIN → `/admin/accounts`
   - RECEPTIONIST → `/reception/members`
   - TRAINER → `/trainer/schedule`
   - MEMBER → `/member/booking`

---

## Luồng thay thế / lỗi

### E-1 Sai email/mật khẩu (Hình 10)
- Backend tăng `failed_attempts` (+1)
- Response 401, message: **"Email hoặc mật khẩu không đúng. Vui lòng thử lại."**
- Frontend: banner đỏ nhạt trên form, nội dung đúng nguyên văn trên

### E-2 Tài khoản bị khóa — sau 5 lần sai liên tiếp (Hình 11)
- Backend set `locked_until = now() + 5 phút`, reset `failed_attempts = 0`
- Response 401, message: **"Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau 5 phút."**
- Mỗi lần thử khi đang khóa: trả lại cùng message (không tăng thêm)
- Sau 5 phút: `locked_until` đã qua → tự mở khóa, cho đăng nhập lại

### E-3 Tài khoản ngừng hoạt động
- Response 401, message: **"Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên."**

### S-1 Quên mật khẩu (Hình 12–13)
- Link **"Quên mật khẩu?"** → route `/forgot-password`
- Form nhập email, nút **"Gửi liên kết đặt lại"**
- Email không tồn tại (Hình 13): **"Email không tồn tại trong hệ thống."**
- Email hợp lệ: tạo token reset (UUID, hết hạn 1 giờ), gửi qua NotificationService (mock log), hiện thông báo "Liên kết đặt lại mật khẩu đã được gửi đến email của bạn."
- Route `/reset-password?token=...`: form **Mật khẩu mới** + **Nhập lại mật khẩu**
- Validate: mật khẩu ≥ 8 ký tự, hai trường khớp
- Token hết hạn / không hợp lệ: **"Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn."**
- Thành công: cập nhật password_hash, xóa token, toast **"Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập."** → redirect `/login`

---

## API endpoints (CLAUDE.md mục 8)

```
POST /auth/login          body: { email, password }
POST /auth/forgot-password  body: { email }
POST /auth/reset-password   body: { token, newPassword, confirmPassword }
```

Response lỗi chuẩn: `{ "field": "...", "message": "..." }` — message tiếng Việt đúng nguyên văn.

### LoginResponse (JWT payload)
```json
{
  "token": "eyJ...",
  "role": "ADMIN | RECEPTIONIST | TRAINER | MEMBER",
  "fullName": "Nguyễn Văn A",
  "email": "admin@picore.vn",
  "userId": 1
}
```

---

## Data model (CLAUDE.md mục 7)

```sql
user_account(
  id BIGINT PK AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(15),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','RECEPTIONIST','TRAINER','MEMBER') NOT NULL,
  status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  failed_attempts INT DEFAULT 0,
  locked_until DATETIME NULL,
  must_change_password BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- thêm cho forgot-password flow:
  reset_token VARCHAR(100) NULL,
  reset_token_expires_at DATETIME NULL
)
```

> `reset_token` và `reset_token_expires_at` là mở rộng hợp lý — không có trong spec nhưng cần thiết cho S-1.

---

## Business rules

- Mật khẩu hash bằng **BCrypt**
- JWT access token (đã có `JwtTokenProvider` tại `com.picore.common.security`)
- Khóa **5 phút** sau **5 lần** sai liên tiếp
- Token reset mật khẩu hết hạn sau **1 giờ**
- Email là định danh duy nhất (không có username riêng)
- Không soft-delete `UserAccount` ở UC này — chỉ đọc status

---

## Design system (frontend)

- Card trắng `rounded-xl shadow-md`, `max-w-sm`, căn giữa màn hình nền `#F3F4F6`
- Logo: chữ **"Pi"** màu teal `#0D9488` (font-bold text-3xl) + chữ **"Core"** màu đen
- Subtitle: `"Hệ thống Quản lý Phòng tập Pilates"` — text-gray-500 text-sm
- Input: border rounded px-3 py-2, focus:ring-teal-500
- Link "Quên mật khẩu?": text-teal-600 hover:underline, căn phải
- Nút "Đăng nhập": bg-teal-600 hover:bg-teal-700 text-white w-full py-2 rounded
- Banner lỗi: `bg-red-50 border border-red-300 text-red-700 rounded p-3`
- Font: Roboto (đã có trong index.html)

---

## Files backend cần tạo

```
backend/src/main/java/com/picore/auth/
├── UserAccount.java          (JPA entity — NO Lombok)
├── UserAccountRepository.java
├── AuthController.java
├── AuthService.java
└── dto/
    ├── LoginRequest.java     (record)
    ├── LoginResponse.java    (record)
    ├── ForgotPasswordRequest.java  (record)
    └── ResetPasswordRequest.java   (record)
```

## Files frontend cần tạo

```
frontend/src/
├── pages/
│   ├── Login.tsx
│   ├── ForgotPassword.tsx
│   └── ResetPassword.tsx
└── api/
    └── auth.ts
```

Cập nhật `App.tsx`: thêm route `/forgot-password` và `/reset-password`.
Cập nhật `stores/auth.ts` nếu cần (setAuth đã có).
