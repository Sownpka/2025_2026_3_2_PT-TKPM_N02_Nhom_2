package com.picore.booking.dto;

import java.time.LocalDateTime;

/**
 * Kết quả trả về sau khi đặt lịch thành công (UC5.1).
 */
public record BookingResponse(
        Long id,
        Long classSessionId,
        String status,
        LocalDateTime bookedAt
) {
}
