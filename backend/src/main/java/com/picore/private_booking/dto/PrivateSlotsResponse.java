package com.picore.private_booking.dto;

import java.util.List;

/**
 * UC5.2 — lưới khung giờ có thể đăng ký buổi 1-1/1-2 trong tuần mục tiêu.
 *
 * @param targetWeek     tuần đang hiển thị, định dạng ISO "YYYY-Www"
 * @param deadlinePassed true nếu đã quá hạn đăng ký cho tuần kế (frontend hiển thị cảnh báo)
 * @param slots          danh sách khung giờ × HLV trong tuần
 */
public record PrivateSlotsResponse(
        String targetWeek,
        boolean deadlinePassed,
        List<SlotEntry> slots
) {
    public record SlotEntry(
            Long trainerId,
            String trainerName,
            String date,        // "yyyy-MM-dd"
            String dayOfWeek,   // "MON","TUE"... (3 ký tự viết hoa)
            String startTime,   // "08:00"
            String endTime,     // "09:00"
            boolean available   // true = còn trống
    ) {
    }
}
