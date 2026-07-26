package com.picore.packageplan.dto;

import com.picore.packageplan.PackageType;

public record PackageTypeResponse(
        Long id,
        String name,
        String category,
        Integer sessions,
        Integer durationDays,
        Long price,
        String description,
        String status
) {
    public static PackageTypeResponse from(PackageType pt) {
        return new PackageTypeResponse(
                pt.getId(),
                pt.getName(),
                pt.getCategory() != null ? pt.getCategory().name() : null,
                pt.getSessions(),
                pt.getDurationDays(),
                pt.getPrice(),
                pt.getDescription(),
                pt.getStatus() != null ? pt.getStatus().name() : null
        );
    }
}
