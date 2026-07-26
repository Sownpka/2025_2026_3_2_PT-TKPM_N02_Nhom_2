package com.picore.me.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Một mục trong danh sách lịch tập của hội viên (UC5.1 — GET /me/bookings).
 * Dùng chung cho các bộ lọc UPCOMING / COMPLETED / CANCELLED.
 */
public record MyBookingItem(
        Long bookingId,
        String className,
        String trainerName,
        LocalDate sessionDate,
        LocalTime startTime,
        LocalTime endTime,
        String bookingStatus,
        LocalDateTime bookedAt,
        LocalDateTime cancelledAt
) {
}
