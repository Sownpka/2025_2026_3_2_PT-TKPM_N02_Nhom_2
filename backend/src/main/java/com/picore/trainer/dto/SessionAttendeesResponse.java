package com.picore.trainer.dto;

import java.util.List;

/**
 * UC5.5 — Danh sách học viên của một buổi học (HLV xem).
 * sessionInfo mô tả buổi học; attendees là toàn bộ booking (mọi trạng thái, kể cả CANCELLED).
 */
public record SessionAttendeesResponse(
        SessionInfo sessionInfo,
        List<AttendeeEntry> attendees
) {
    public record SessionInfo(
            Long sessionId,
            String className,
            String sessionDate,   // "yyyy-MM-dd"
            String startTime,     // "HH:mm"
            String endTime,
            String trainerName,
            boolean isPast
    ) {}

    public record AttendeeEntry(
            Long bookingId,
            String memberName,
            String phone,          // nullable
            String bookingStatus,  // "BOOKED" | "CANCELLED" | "ATTENDED" | "NO_SHOW"
            String checkedInAt     // nullable ISO datetime
    ) {}
}
