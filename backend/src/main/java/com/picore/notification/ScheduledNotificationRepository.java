package com.picore.notification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository cho hàng đợi nhắc lịch (UC5.4).
 */
public interface ScheduledNotificationRepository extends JpaRepository<ScheduledNotification, Long> {

    // Các bản ghi tới hạn (send_at <= now) và chưa gửi.
    List<ScheduledNotification> findBySendAtBeforeAndSentFalse(LocalDateTime now);
}
