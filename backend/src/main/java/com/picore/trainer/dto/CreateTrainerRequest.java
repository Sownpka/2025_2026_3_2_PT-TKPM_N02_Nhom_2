package com.picore.trainer.dto;

import jakarta.validation.constraints.NotNull;

public record CreateTrainerRequest(
        @NotNull(message = "Trường này là bắt buộc") Long userAccountId,
        String specialty,
        String contactPhone
) {
}
