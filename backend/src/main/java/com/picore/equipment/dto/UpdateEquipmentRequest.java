package com.picore.equipment.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateEquipmentRequest(
        @NotBlank(message = "Trường này là bắt buộc") String name,
        @NotBlank(message = "Trường này là bắt buộc") String type,
        String location,
        String note
) {
}
