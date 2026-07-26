package com.picore.member.dto;

public record ActivePackageInfo(
        Long id,
        String packageName,
        Integer sessionsRemaining,
        String startDate,
        String endDate,
        String status
) {
}
