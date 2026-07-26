package com.picore.member.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateMemberRequest(
        @NotBlank String fullName,
        @NotBlank String phone,
        String dob,
        String gender,
        String note,
        String status
) {
}
