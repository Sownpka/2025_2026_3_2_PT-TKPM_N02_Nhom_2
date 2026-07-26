package com.picore.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateAccountRequest(
        @NotBlank String fullName,
        String phone,
        @NotNull String role,
        String status
) {
}
