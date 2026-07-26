package com.picore.member.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateMemberRequest(
        @NotBlank String fullName,
        @NotBlank String phone,
        @Email String email,
        String dob,
        String gender,
        String note
) {
}
