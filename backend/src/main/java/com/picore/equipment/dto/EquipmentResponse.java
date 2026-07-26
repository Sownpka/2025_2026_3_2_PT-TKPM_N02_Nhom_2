package com.picore.equipment.dto;

import com.picore.equipment.Equipment;

public record EquipmentResponse(
        Long id,
        String code,
        String name,
        String type,
        String location,
        String note,
        String status
) {
    public static EquipmentResponse from(Equipment e) {
        return new EquipmentResponse(
                e.getId(),
                e.getCode(),
                e.getName(),
                e.getType(),
                e.getLocation(),
                e.getNote(),
                e.getStatus() != null ? e.getStatus().name() : null
        );
    }
}
