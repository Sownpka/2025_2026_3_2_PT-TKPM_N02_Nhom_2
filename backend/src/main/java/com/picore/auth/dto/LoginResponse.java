package com.picore.auth.dto;

public record LoginResponse(
        String token,
        String role,
        String fullName,
        String email,
        Long userId
) {
}
