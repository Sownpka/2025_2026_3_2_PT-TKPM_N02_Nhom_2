package com.picore.clazz.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record TimetableSession(
        Long sessionId,
        Long gymClassId,
        String className,
        String trainerName,
        LocalDate sessionDate,
        String dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        int capacity,
        int bookedCount,
        int availableSpots,
        // UC5.1 — trạng thái đặt lịch của hội viên đang đăng nhập cho buổi này.
        // null nếu không phải MEMBER hoặc chưa đặt; "BOOKED"/"CANCELLED"/"ATTENDED"/"NO_SHOW".
        String myBookingStatus
) {
}
