package com.picore.me.dto;

/**
 * Gói tập của hội viên đang đăng nhập (UC2.2 — GET /me/packages).
 * nearExpiry = true khi sắp hết buổi (≤ 2) hoặc sắp hết hạn (≤ 7 ngày).
 */
public record MyPackageResponse(
        Long id,
        String packageTypeName,
        String category,
        Integer sessionsRemaining,
        String startDate,
        String endDate,
        String status,
        boolean nearExpiry
) {
}
