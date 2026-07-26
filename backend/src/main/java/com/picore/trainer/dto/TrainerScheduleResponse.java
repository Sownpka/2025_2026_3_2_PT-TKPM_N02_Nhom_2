package com.picore.trainer.dto;

import java.util.List;

/**
 * UC4.4 — Lịch dạy của HLV trong 1 tuần.
 * Trả về danh sách buổi (GROUP + PRIVATE_1_1 + PRIVATE_1_2) của HLV đang đăng nhập.
 */
public record TrainerScheduleResponse(
        String trainerName,
        String week,
        List<SessionItem> sessions
) {
    public record SessionItem(
            Long sessionId,
            String className,
            String sessionDate,   // "yyyy-MM-dd"
            String dayOfWeek,     // "MONDAY".."SUNDAY"
            String startTime,     // "HH:mm"
            String endTime,       // "HH:mm"
            int bookedCount,
            int capacity,
            String type           // "GROUP" | "PRIVATE_1_1" | "PRIVATE_1_2"
    ) {}
}
