package com.picore.me.dto;

/**
 * Một buổi tập trong lịch sử của hội viên (UC2.2 — GET /me/history).
 * Chỉ gồm các buổi đã ATTENDED / NO_SHOW.
 */
public record MyHistoryItem(
        String sessionDate,
        String className,
        String trainerName,
        String startTime,
        String endTime,
        String attendanceStatus
) {
}
