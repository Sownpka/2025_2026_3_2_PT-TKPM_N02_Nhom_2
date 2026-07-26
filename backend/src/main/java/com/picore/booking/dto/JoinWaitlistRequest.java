package com.picore.booking.dto;

/**
 * Yêu cầu tham gia danh sách chờ khi lớp đã đầy (UC5.1).
 */
public record JoinWaitlistRequest(
        Long classSessionId
) {
}
