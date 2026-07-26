## QA Report: UC1.1 — Đăng nhập

### Status: PASS ✅ (Issue #1 đã fix — client.ts loại trừ /auth/ khỏi auto-redirect 401)

Toàn bộ code riêng của UC1.1 (module `auth` backend + 3 page + `api/auth.ts` frontend) khớp spec 1:1 về shape, business rule, nhãn tiếng Việt và routing. Tuy nhiên có **1 lỗi tích hợp mức HIGH nằm ở `src/api/client.ts` (mã scaffold dùng chung)** khiến banner lỗi đăng nhập KHÔNG bao giờ hiển thị — điều này phá vỡ các luồng bắt buộc E-1/E-2/E-3 của spec. Phải sửa trước khi coi là DONE.

### Issues found

| # | Severity | File:Line | Description | Fix suggestion |
|---|----------|-----------|-------------|----------------|
| 1 | HIGH | `frontend/src/api/client.ts:19-24` | Response interceptor redirect trên **mọi** 401: `clearAuth()` + `window.location.href='/login'`. Backend trả lỗi đăng nhập (sai mật khẩu / khóa / INACTIVE) đều là **401**, nên khi login thất bại trang bị **reload cứng về /login**, xóa sạch state → banner lỗi trong `Login.tsx` (`setError`) chớp rồi mất, người dùng KHÔNG thấy "Email hoặc mật khẩu không đúng...", "Tài khoản tạm khóa...", "Tài khoản đã bị vô hiệu hóa...". Vi phạm E-1/E-2/E-3 (spec bắt buộc hiển thị banner đỏ đúng nguyên văn). | Bỏ qua redirect cho endpoint auth: đọc `error.config?.url`, chỉ redirect khi `status===401 && !url.startsWith('/auth/')`. Forgot/reset không bị (trả 400) nên chỉ cần loại trừ `/auth/login`. |
| 2 | LOW | `backend/.../AuthService.java:91-99` | `resetPassword` kiểm tra khớp mật khẩu + độ dài **TRƯỚC** khi kiểm tra token hợp lệ. Với token hết hạn nhưng mật khẩu nhập lệch, người dùng nhận "Mật khẩu nhập lại không khớp." thay vì "Liên kết... không hợp lệ hoặc đã hết hạn.". Không sai spec (spec không quy định thứ tự) nhưng UX gây nhiễu. | Cân nhắc validate token trước, hoặc giữ nguyên nếu nhóm chấp nhận. |
| 3 | LOW | `frontend/src/pages/Login.tsx:33` | Chỉ hiển thị `parseApiError(err)[0].message`. Nếu bỏ trống cả 2 field (400 array 2 phần tử từ @NotBlank) chỉ hiện 1 lỗi. Thực tế input có `required` nên khó xảy ra. | Chấp nhận được; không cần sửa cho UC1.1. |

### Passed checks

**Shape alignment (đối chiếu từ code thực tế):**
- `LoginRequest {email, password}` (record) ↔ `client.post(AUTH.LOGIN, {email, password})` — khớp.
- `LoginResponse {token, role, fullName, email, userId}` ↔ interface `LoginResponse` trong `types/index.ts` — khớp từng field.
- `userId`: backend `Long` → frontend `number` — đúng.
- `role`: backend `String` (`role.name()`) → frontend union `Role = 'ADMIN'|'RECEPTIONIST'|'TRAINER'|'MEMBER'` — khớp 4 giá trị enum backend.
- Error `{field?, message}`: `@JsonInclude(NON_NULL)` ẩn `field` khi null; `parseApiError` xử lý object có `message` và `field` optional — đúng.
- Validation array `[{field, message}]` (từ `handleValidation`): `parseApiError` nhận diện `Array.isArray(data)` và lọc — đúng.
- `ForgotPasswordRequest {email}` và `ResetPasswordRequest {token, newPassword, confirmPassword}` khớp body gửi từ `forgotPassword()` / `resetPassword()`.

**Business rules (spec UC1.1 + CLAUDE.md mục 5):**
- INACTIVE → 401 "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên." (AuthService:44-47) — đúng.
- Check `lockedUntil` **TRƯỚC** khi check password (dòng 50 trước dòng 55) — đúng.
- Sai mật khẩu: `failedAttempts + 1 >= 5` → `lockedUntil = now + 5 phút`, `failedAttempts = 0`; ngược lại `++` (AuthService:56-61) — đúng.
- Khi đang khóa: throw trước khi tới nhánh tăng failedAttempts → KHÔNG tăng thêm — đúng.
- Đăng nhập đúng: reset `failedAttempts=0`, `lockedUntil=null`, tạo JWT `generateToken(id, email, role)` (chữ ký khớp JwtTokenProvider) — đúng.
- Reset token: `UUID.randomUUID()`, hết hạn `now + 1 giờ`, xóa `resetToken`/`resetTokenExpiresAt` sau khi đổi mật khẩu (AuthService:81-83, 108-109) — đúng.
- `resetPassword`: validate cả `!newPassword.equals(confirmPassword)` VÀ `length < 8` — đủ 2 điều kiện.
- BCrypt qua bean `PasswordEncoder`; `@Transactional` cả 3 method — đúng.

**Vietnamese labels (đọc từ code):**
- Nút "Đăng nhập" / "Đang đăng nhập..." (Login.tsx:100) — đúng.
- Link "Quên mật khẩu?" (Login.tsx:91) — đúng.
- Nút "Gửi liên kết đặt lại" (ForgotPassword.tsx:86) — đúng.
- Nút "Đặt lại mật khẩu" (ResetPassword.tsx:120) — đúng.
- Banner lỗi login render nguyên văn message từ backend (`parseApiError(err)[0].message`), không hard-code — đúng.
- Mọi message backend khớp nguyên văn spec: "Email hoặc mật khẩu không đúng. Vui lòng thử lại.", "Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau 5 phút.", "Email không tồn tại trong hệ thống.", "Liên kết đặt lại mật khẩu đã được gửi đến email của bạn.", "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập.", "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", "Mật khẩu nhập lại không khớp.", "Mật khẩu phải có ít nhất 8 ký tự." — tất cả khớp.

**Phân quyền / routing:**
- `SecurityConfig` `permitAll()` cho `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` (path sau context-path `/api`) — đúng.
- `client.ts` baseURL `/api` + endpoints `/auth/...` → URL `/api/auth/...` khớp context-path backend.
- Redirect theo role (ROLE_HOME, Login.tsx:8-13): ADMIN→`/admin/accounts`, RECEPTIONIST→`/reception/members`, TRAINER→`/trainer/schedule`, MEMBER→`/member/booking` — đúng; 4 route đều tồn tại trong `App.tsx`.
- `App.tsx` có route `/login`, `/forgot-password`, `/reset-password` — đủ.

### Recommendations

- **Bắt buộc (blocker):** Sửa Issue #1 trong `client.ts` — loại trừ `/auth/login` khỏi auto-redirect 401. Đây là điểm phá vỡ DoD ("TẤT CẢ luồng thay thế E-x hoạt động đúng"). Sau khi sửa, cần test tay: nhập sai mật khẩu → banner đỏ hiển thị và giữ nguyên (không reload).
- **Deployment:** `ddl-auto: validate` + chưa có migration/DDL cho bảng `user_account` (gồm `reset_token`, `reset_token_expires_at`). Cần script tạo bảng + seed tài khoản BCrypt (spec mục 9: `admin@picore.vn / Admin123!`) trước khi chạy, nếu không app fail lúc khởi động — không thể verify runtime.
- **Ngoài phạm vi UC1.1 (ghi nhận):** chưa có ProtectedRoute theo vai trò cho các trang sau đăng nhập; cột `must_change_password` chưa được dùng để ép đổi mật khẩu tạm (liên quan UC2.1). Để lại cho UC1.2/layout chung như done-doc đã nêu.
- Cân nhắc Issue #2 (thứ tự validate token trong resetPassword) nếu muốn thông báo chính xác hơn khi token hết hạn.
