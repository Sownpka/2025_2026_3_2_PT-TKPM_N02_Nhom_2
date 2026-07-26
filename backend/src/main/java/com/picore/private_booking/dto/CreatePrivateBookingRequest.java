package com.picore.private_booking.dto;

/**
 * UC5.2 — yêu cầu đăng ký một buổi 1-1/1-2.
 *
 * @param trainerId       HLV được chọn
 * @param date            ngày buổi tập "yyyy-MM-dd"
 * @param startTime       giờ bắt đầu "HH:mm" (buổi kéo dài 1 giờ)
 * @param memberPackageId gói tập dùng để trừ buổi
 * @param partnerMemberId (gói 1-2) mời một hội viên cụ thể cùng tập — nullable
 * @param joinMatchmaking (gói 1-2) nhờ hệ thống ghép cặp — nullable
 */
public record CreatePrivateBookingRequest(
        Long trainerId,
        String date,
        String startTime,
        Long memberPackageId,
        Long partnerMemberId,
        Boolean joinMatchmaking
) {
}
