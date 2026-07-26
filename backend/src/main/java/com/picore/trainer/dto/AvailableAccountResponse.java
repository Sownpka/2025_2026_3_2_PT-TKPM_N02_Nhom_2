package com.picore.trainer.dto;

public record AvailableAccountResponse(
        Long id,
        String fullName,
        String email
) {
}
