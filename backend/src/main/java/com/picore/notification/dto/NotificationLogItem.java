package com.picore.notification.dto;

/**
 * Một dòng trong lịch sử thông báo (/admin/notifications — UC5.4).
 */
public record NotificationLogItem(
        Long id,
        String memberName,
        String channel,
        String type,
        String content,
        String status,
        int retryCount,
        String sentAt) {
}
