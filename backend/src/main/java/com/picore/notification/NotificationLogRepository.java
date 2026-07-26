package com.picore.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository cho lịch sử thông báo (UC5.4). Hỗ trợ lọc theo type / status cho
 * màn hình /admin/notifications, luôn sắp xếp mới nhất trước.
 */
public interface NotificationLogRepository extends JpaRepository<NotificationLog, Long> {

    Page<NotificationLog> findByTypeAndStatusOrderBySentAtDesc(
            NotificationLog.NotificationType type,
            NotificationLog.NotificationStatus status,
            Pageable pageable);

    Page<NotificationLog> findByTypeOrderBySentAtDesc(
            NotificationLog.NotificationType type, Pageable pageable);

    Page<NotificationLog> findByStatusOrderBySentAtDesc(
            NotificationLog.NotificationStatus status, Pageable pageable);

    Page<NotificationLog> findAllByOrderBySentAtDesc(Pageable pageable);
}
