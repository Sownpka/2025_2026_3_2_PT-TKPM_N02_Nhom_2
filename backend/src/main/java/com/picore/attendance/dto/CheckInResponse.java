package com.picore.attendance.dto;

/**
 * Kết quả sau khi điểm danh "Có mặt" / "No-show" (UC5.3).
 * checkedInAt null với trường hợp NO_SHOW (không có thời điểm check-in).
 */
public record CheckInResponse(
        Long bookingId,
        String status,
        java.time.LocalDateTime checkedInAt
) {
}
