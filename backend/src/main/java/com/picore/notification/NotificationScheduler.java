package com.picore.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Flow B (UC5.4) — quét hàng đợi nhắc lịch mỗi 60 giây, gửi nhắc cho các bản ghi
 * tới hạn (send_at <= now, chưa gửi) rồi đánh dấu sent = true.
 *
 * <p>{@code @EnableScheduling} đã bật ở {@code PicoreApplication}.
 */
@Component
public class NotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationScheduler.class);

    private final ScheduledNotificationRepository scheduledRepo;
    private final NotificationService notificationService;

    public NotificationScheduler(ScheduledNotificationRepository scheduledRepo,
                                 NotificationService notificationService) {
        this.scheduledRepo = scheduledRepo;
        this.notificationService = notificationService;
    }

    @Scheduled(fixedDelay = 60_000)
    public void processScheduledNotifications() {
        List<ScheduledNotification> due =
                scheduledRepo.findBySendAtBeforeAndSentFalse(LocalDateTime.now());
        if (due.isEmpty()) {
            return;
        }
        for (ScheduledNotification sn : due) {
            try {
                notificationService.sendReminder(sn);
                sn.setSent(true);
                scheduledRepo.save(sn);
            } catch (Exception ex) {
                log.warn("[Scheduler] Nhắc lịch thất bại bookingId={}: {}",
                        sn.getBookingId(), ex.getMessage());
            }
        }
    }
}
