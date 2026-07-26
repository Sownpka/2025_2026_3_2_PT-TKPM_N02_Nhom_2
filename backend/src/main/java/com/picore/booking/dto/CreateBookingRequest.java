package com.picore.booking.dto;

/**
 * Yêu cầu đặt lịch tập (UC5.1).
 * memberId chỉ dùng khi RECEPTIONIST đặt hộ hội viên; MEMBER tự đặt thì bỏ trống (lấy từ SecurityContext).
 */
public record CreateBookingRequest(
        Long classSessionId,
        Long memberPackageId,
        Long memberId
) {
}
