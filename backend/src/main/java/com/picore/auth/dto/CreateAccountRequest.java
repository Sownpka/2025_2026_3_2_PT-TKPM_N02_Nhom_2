package com.picore.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateAccountRequest(
        @NotBlank String fullName,
        @NotBlank @Email String email,
        String phone,
        @NotNull String role,
        @NotBlank String password,
        @NotBlank String confirmPassword,
        Long memberId
) {
}
