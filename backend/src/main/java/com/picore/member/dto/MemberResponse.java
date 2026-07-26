package com.picore.member.dto;

public record MemberResponse(
        Long id,
        String fullName,
        String phone,
        String email,
        String dob,
        String gender,
        String note,
        String status,
        String createdAt
) {
}
