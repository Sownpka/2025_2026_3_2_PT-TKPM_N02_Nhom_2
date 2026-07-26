package com.picore.attendance.dto;

/**
 * Body cho điểm danh nhanh (walk-in) — UC5.3 POST /attendance/quick-checkin.
 */
public record QuickCheckinRequest(String phone) {
}
