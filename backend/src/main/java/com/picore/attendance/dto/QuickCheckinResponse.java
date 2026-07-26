package com.picore.attendance.dto;

/**
 * Kết quả điểm danh nhanh (walk-in) — UC5.3. sessionsRemaining là số buổi còn lại
 * sau khi đã trừ 1 buổi (null nếu gói không giới hạn).
 */
public record QuickCheckinResponse(
        String memberName,
        String packageTypeName,
        Integer sessionsRemaining
) {
}
