package com.picore.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(
        @NotBlank(message = "Vui lòng nhập email.") String email
) {
}
