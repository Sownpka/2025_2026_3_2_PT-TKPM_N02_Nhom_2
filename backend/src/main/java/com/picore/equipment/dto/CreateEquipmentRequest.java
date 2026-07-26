package com.picore.equipment.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateEquipmentRequest(
        @NotBlank(message = "Trường này là bắt buộc") String code,
        @NotBlank(message = "Trường này là bắt buộc") String name,
        @NotBlank(message = "Trường này là bắt buộc") String type,
        String location,
        String note
) {
}
