package com.picore.notification;

public interface NotificationService {
    void sendActivationEmail(String toEmail, String fullName, String tempPassword);
    void sendPasswordResetEmail(String toEmail, String resetToken);
    void sendBookingConfirmation(Long memberId, Long bookingId);
    void sendBookingReminder(Long memberId, Long bookingId);
    void sendWaitlistInvite(Long memberId, Long classSessionId);
    void sendPackageRegistrationEmail(Long memberId, Long memberPackageId);

    // UC5.4 — gửi nhắc lịch trước 2 giờ (được NotificationScheduler gọi).
    void sendReminder(ScheduledNotification scheduledNotification);
}
