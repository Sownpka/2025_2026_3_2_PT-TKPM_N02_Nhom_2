package com.picore.clazz.dto;

import java.time.LocalTime;
import java.util.List;

public record GymClassResponse(
        Long id,
        String name,
        String equipmentType,
        Long trainerId,
        String trainerName,
        List<String> daysOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        int capacity,
        String description,
        String status
) {
}
