package com.picore.trainer.dto;

import com.picore.trainer.TrainerProfile;

public record TrainerResponse(
        Long id,
        Long userAccountId,
        String fullName,
        String email,
        String specialty,
        String contactPhone,
        String status,
        long totalMinutesThisWeek
) {
    public static TrainerResponse from(TrainerProfile t, long totalMinutesThisWeek) {
        return new TrainerResponse(
                t.getId(),
                t.getUserAccount() != null ? t.getUserAccount().getId() : null,
                t.getUserAccount() != null ? t.getUserAccount().getFullName() : null,
                t.getUserAccount() != null ? t.getUserAccount().getEmail() : null,
                t.getSpecialty(),
                t.getContactPhone(),
                t.getStatus() != null ? t.getStatus().name() : null,
                totalMinutesThisWeek
        );
    }
}
