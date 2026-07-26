package com.picore.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record ResetPasswordRequest(
        @NotBlank(message = "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.") String token,
        @NotBlank(message = "Vui lòng nhập mật khẩu mới.") String newPassword,
        @NotBlank(message = "Vui lòng nhập lại mật khẩu.") String confirmPassword
) {
}
