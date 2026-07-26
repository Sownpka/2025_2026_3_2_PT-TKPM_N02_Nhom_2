## Backend done: UC1.1 — Đăng nhập

### Files created/modified
Tất cả file mới (không sửa file có sẵn):

- `D:\Pi-core\backend\src\main\java\com\picore\auth\UserAccount.java`
- `D:\Pi-core\backend\src\main\java\com\picore\auth\UserAccountRepository.java`
- `D:\Pi-core\backend\src\main\java\com\picore\auth\AuthController.java`
- `D:\Pi-core\backend\src\main\java\com\picore\auth\AuthService.java`
- `D:\Pi-core\backend\src\main\java\com\picore\auth\dto\LoginRequest.java`
- `D:\Pi-core\backend\src\main\java\com\picore\auth\dto\LoginResponse.java`
- `D:\Pi-core\backend\src\main\java\com\picore\auth\dto\ForgotPasswordRequest.java`
- `D:\Pi-core\backend\src\main\java\com\picore\auth\dto\ResetPasswordRequest.java`

Trạng thái build: `mvn -o clean compile` → **BUILD SUCCESS** (18 source files, javac release 17).

### API endpoints
Lưu ý: `application.yml` có `server.servlet.context-path: /api`, nên URL thực tế có tiền tố `/api`. Controller mapping là `/auth`.

- **POST /api/auth/login** → 200 `LoginResponse`; lỗi → 401 `{ field?, message }`
- **POST /api/auth/forgot-password** → 200 `{ "message": "Liên kết đặt lại mật khẩu đã được gửi đến email của bạn." }`; email không tồn tại → 400 `{ "field": "email", "message": "Email không tồn tại trong hệ thống." }`
- **POST /api/auth/reset-password** → 200 `{ "message": "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập." }`; lỗi validate → 400 `{ field?, message }`

Cả 3 route đã được `permitAll()` sẵn trong `SecurityConfig`.

### Request/Response shapes

**LoginRequest** (record)
- `String email` (@NotBlank)
- `String password` (@NotBlank)

**LoginResponse** (record)
- `String token`
- `String role` (ADMIN | RECEPTIONIST | TRAINER | MEMBER)
- `String fullName`
- `String email`
- `Long userId`

**ForgotPasswordRequest** (record)
- `String email` (@NotBlank)

**ResetPasswordRequest** (record)
- `String token` (@NotBlank)
- `String newPassword` (@NotBlank)
- `String confirmPassword` (@NotBlank)

**UserAccount** (JPA entity, class thường — KHÔNG Lombok)
- `Long id` (IDENTITY)
- `String fullName` (full_name, not null, 100)
- `String email` (unique, not null, 150)
- `String phone` (15)
- `String passwordHash` (password_hash, not null, 255)
- `Role role` (enum STRING: ADMIN/RECEPTIONIST/TRAINER/MEMBER) — nested enum `UserAccount.Role`
- `Status status` (enum STRING: ACTIVE/INACTIVE, default ACTIVE) — nested enum `UserAccount.Status`
- `int failedAttempts` (default 0)
- `LocalDateTime lockedUntil` (nullable)
- `boolean mustChangePassword` (default false)
- `LocalDateTime createdAt` (set qua @PrePersist)
- `String resetToken` (nullable, 100)
- `LocalDateTime resetTokenExpiresAt` (nullable)

> Ghi chú thiết kế: 2 enum `Role`/`Status` đặt lồng (nested public enum) trong `UserAccount` để không phát sinh file ngoài danh sách spec yêu cầu. Tham chiếu: `UserAccount.Role.ADMIN`, `UserAccount.Status.ACTIVE`.

### Business rules enforced
- **login**: không thấy email → 401 "Email hoặc mật khẩu không đúng. Vui lòng thử lại."
- INACTIVE → 401 "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên."
- `lockedUntil != null && lockedUntil.isAfter(now)` → 401 "Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau 5 phút." (không tăng thêm failedAttempts khi đang khóa)
- Sai mật khẩu: nếu `failedAttempts + 1 >= 5` → set `lockedUntil = now + 5 phút`, `failedAttempts = 0`; ngược lại `failedAttempts++`; save rồi → 401 "Email hoặc mật khẩu không đúng. Vui lòng thử lại."
- Đăng nhập đúng: reset `failedAttempts = 0`, `lockedUntil = null`, save, tạo JWT qua `JwtTokenProvider.generateToken(id, email, role)`.
- Tự mở khóa sau 5 phút: khi `lockedUntil` đã qua, điều kiện khóa false → cho đăng nhập lại (không cần job nền).
- **forgotPassword**: email không tồn tại → 400 field=email "Email không tồn tại trong hệ thống."; hợp lệ → `resetToken = UUID.randomUUID()`, `resetTokenExpiresAt = now + 1 giờ`, save, gọi `notificationService.sendPasswordResetEmail(email, resetToken)`.
- **resetPassword**: `!newPassword.equals(confirmPassword)` → 400 field=confirmPassword "Mật khẩu nhập lại không khớp."; `newPassword.length() < 8` → 400 field=newPassword "Mật khẩu phải có ít nhất 8 ký tự."; token không thấy hoặc `resetTokenExpiresAt` đã qua → 400 "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn."; thành công → `passwordHash = encode(newPassword)`, xóa `resetToken`/`resetTokenExpiresAt`, save.
- BCrypt qua bean `PasswordEncoder` (BCryptPasswordEncoder trong SecurityConfig).
- `@Transactional` trên cả 3 method service.
- Response lỗi `{ field?, message }` qua `ApiException` + `GlobalExceptionHandler` (đã có sẵn, field null bị ẩn nhờ @JsonInclude NON_NULL).

### Issues / TODO
- **DB schema**: `spring.jpa.hibernate.ddl-auto: validate` → cần có bảng `user_account` với đủ cột (gồm `reset_token`, `reset_token_expires_at`) trong MySQL trước khi chạy, nếu không app sẽ fail lúc khởi động. Chưa có file migration/DDL trong repo — cần tạo script tạo bảng + seed tài khoản mẫu (mật khẩu BCrypt) để test đăng nhập.
- **Success message của login**: spec không yêu cầu message riêng khi login thành công (chỉ trả LoginResponse) — đã làm đúng vậy.
- **NotificationService**: dùng `MockNotificationService` (log) đã có sẵn — email reset chỉ log, chưa gửi SMTP thật.
- **Endpoint URL**: nhớ frontend gọi qua `/api/auth/...` do context-path `/api`. `SecurityConfig` permitAll dùng path sau context-path (`/auth/login`...) nên vẫn khớp.
- Validation @NotBlank trên record trả về dạng `List<ErrorResponse>` (theo `handleValidation` có sẵn) khác với lỗi nghiệp vụ trả object đơn — frontend cần lưu ý 2 shape này nếu bỏ trống trường.
