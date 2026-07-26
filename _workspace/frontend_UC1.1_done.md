## Frontend done: UC1.1

### Files created/modified
- D:\Pi-core\frontend\src\api\auth.ts (tạo mới) — loginUser, forgotPassword, resetPassword + helper parseApiError
- D:\Pi-core\frontend\src\pages\Login.tsx (tạo mới)
- D:\Pi-core\frontend\src\pages\ForgotPassword.tsx (tạo mới)
- D:\Pi-core\frontend\src\pages\ResetPassword.tsx (tạo mới)
- D:\Pi-core\frontend\src\types\index.ts (cập nhật) — thêm interface LoginResponse
- D:\Pi-core\frontend\src\App.tsx (cập nhật) — thay route /login, thêm /forgot-password, /reset-password

### TypeScript types defined
- LoginResponse { token, role: Role, fullName, email, userId } — trong src/types/index.ts
- parseApiError(error: unknown): ApiError[] — chuẩn hóa cả 2 shape lỗi backend ({field?, message} và [{field, message}])
- ROLE_HOME: Record<Role, string> — bản đồ redirect theo vai trò (trong Login.tsx)

### Routes added/updated
- /login → Login
- /forgot-password → ForgotPassword
- /reset-password → ResetPassword

### Redirect sau login theo role
- ADMIN → /admin/accounts
- RECEPTIONIST → /reception/members
- TRAINER → /trainer/schedule
- MEMBER → /member/booking

### Ghi chú
- TypeScript strict, không dùng any (parseApiError nhận `unknown`, ép kiểu qua AxiosError). `npx tsc --noEmit` pass sạch.
- Nhãn nút/tiêu đề đúng nguyên văn: "Đăng nhập" / "Đang đăng nhập...", "Gửi liên kết đặt lại", "Đặt lại mật khẩu", "Quên mật khẩu?", "← Quay lại đăng nhập".
- Banner lỗi login dùng đúng class spec (bg-red-50 border border-red-300 text-red-700). Message hiển thị nguyên văn từ backend (vd "Email hoặc mật khẩu không đúng...", "Tài khoản tạm khóa...").
- ForgotPassword: success -> banner xanh (render message nguyên văn từ backend); lỗi field=email hiển thị dưới trường + viền đỏ.
- ResetPassword: lấy token qua useSearchParams; lỗi field=newPassword/confirmPassword hiện dưới từng trường; success -> toast xanh góc phải + redirect /login sau 2 giây.
- Không hard-code URL: dùng AUTH.LOGIN / AUTH.FORGOT_PASSWORD / AUTH.RESET_PASSWORD.

### Issues / TODO
- Chưa có route guard (ProtectedRoute theo role) cho các trang sau đăng nhập — nằm ngoài phạm vi UC1.1, cần thêm ở UC1.2 hoặc bước layout chung.
- Toast của ResetPassword là inline đơn giản; nếu dự án có component Toast dùng chung sau này thì nên thay thế cho nhất quán.
- Chưa viết test (project chưa có test runner cho frontend).
