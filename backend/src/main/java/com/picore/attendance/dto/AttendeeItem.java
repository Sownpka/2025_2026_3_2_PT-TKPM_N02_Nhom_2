package com.picore.attendance.dto;

/**
 * Một hội viên đã đặt trong buổi học (UC5.3 — GET /attendance/{sessionId}/attendees).
 * packageTypeName / sessionsRemaining có thể null nếu booking không gắn gói giới hạn.
 */
public record AttendeeItem(
        Long bookingId,
        Long memberId,
        String memberName,
        String packageTypeName,
        Integer sessionsRemaining,
        String bookingStatus
) {
}
