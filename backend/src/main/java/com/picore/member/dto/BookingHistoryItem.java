package com.picore.member.dto;

public record BookingHistoryItem(
        Long id,
        String className,
        String trainerName,
        String sessionDate,
        String status
) {
}
