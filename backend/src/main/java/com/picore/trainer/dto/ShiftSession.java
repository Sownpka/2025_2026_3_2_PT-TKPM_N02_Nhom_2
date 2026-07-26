package com.picore.trainer.dto;

import java.time.LocalDate;

public record ShiftSession(
        Long sessionId,
        LocalDate sessionDate,
        String dayOfWeek,
        String startTime,
        String endTime,
        String type,
        String className,
        long durationMinutes
) {
}
