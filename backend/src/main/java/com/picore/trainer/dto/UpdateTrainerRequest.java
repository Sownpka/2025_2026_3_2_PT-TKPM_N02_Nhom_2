package com.picore.trainer.dto;

public record UpdateTrainerRequest(
        String specialty,
        String contactPhone
) {
}
