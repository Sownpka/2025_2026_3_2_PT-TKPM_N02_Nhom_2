package com.picore.clazz.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalTime;
import java.util.List;

public record UpdateClassRequest(
        @NotBlank(message = "Trường này là bắt buộc") String name,
        String equipmentType,
        @NotNull(message = "Trường này là bắt buộc") Long trainerId,
        @NotEmpty(message = "Trường này là bắt buộc") List<String> daysOfWeek,
        @NotNull(message = "Trường này là bắt buộc") LocalTime startTime,
        @NotNull(message = "Trường này là bắt buộc") LocalTime endTime,
        @Positive(message = "Trường này là bắt buộc") int capacity,
        String description
) {
}
