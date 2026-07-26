package com.picore.attendance.dto;

/**
 * Tóm tắt một buổi học trong danh sách "Điểm danh hôm nay" (UC5.3 — GET /attendance/today).
 * bookedCount = tổng booking BOOKED + ATTENDED + NO_SHOW; checkedInCount = số booking ATTENDED.
 */
public record SessionSummary(
        Long sessionId,
        String className,
        String trainerName,
        String startTime,
        String endTime,
        int capacity,
        int bookedCount,
        int checkedInCount
) {
}
