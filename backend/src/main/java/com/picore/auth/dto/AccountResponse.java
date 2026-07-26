package com.picore.auth.dto;

public record AccountResponse(
        Long id,
        String fullName,
        String email,
        String phone,
        String role,
        String status,
        String createdAt
) {
}
