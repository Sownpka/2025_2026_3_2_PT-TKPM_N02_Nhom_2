package com.picore.notification;

import com.picore.common.exception.ApiException;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.notification.dto.NotificationLogItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Lịch sử thông báo cho admin (UC5.4) — chỉ xem, không thao tác.
 * GET /api/notifications?type=&status=&page=0&size=20
 */
@RestController
@RequestMapping("/notifications")
@PreAuthorize("hasRole('ADMIN')")
public class NotificationController {

    private final NotificationLogRepository notificationLogRepository;
    private final MemberRepository memberRepository;

    public NotificationController(NotificationLogRepository notificationLogRepository,
                                  MemberRepository memberRepository) {
        this.notificationLogRepository = notificationLogRepository;
        this.memberRepository = memberRepository;
    }

    @GetMapping
    public Page<NotificationLogItem> getNotifications(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(Math.max(page, 0), size <= 0 ? 20 : size);
        NotificationLog.NotificationType typeEnum = parseType(type);
        NotificationLog.NotificationStatus statusEnum = parseStatus(status);

        Page<NotificationLog> logs;
        if (typeEnum != null && statusEnum != null) {
            logs = notificationLogRepository
                    .findByTypeAndStatusOrderBySentAtDesc(typeEnum, statusEnum, pageable);
        } else if (typeEnum != null) {
            logs = notificationLogRepository.findByTypeOrderBySentAtDesc(typeEnum, pageable);
        } else if (statusEnum != null) {
            logs = notificationLogRepository.findByStatusOrderBySentAtDesc(statusEnum, pageable);
        } else {
            logs = notificationLogRepository.findAllByOrderBySentAtDesc(pageable);
        }

        // Batch-load tên hội viên (tránh N+1).
        List<Long> memberIds = logs.getContent().stream()
                .map(NotificationLog::getMemberId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        Map<Long, String> memberNames = memberIds.isEmpty() ? Map.of()
                : memberRepository.findAllById(memberIds).stream()
                        .collect(Collectors.toMap(Member::getId, Member::getFullName));

        return logs.map(logEntry -> toItem(logEntry, memberNames));
    }

    private NotificationLogItem toItem(NotificationLog logEntry, Map<Long, String> memberNames) {
        String memberName = logEntry.getMemberId() == null ? null
                : memberNames.get(logEntry.getMemberId());
        return new NotificationLogItem(
                logEntry.getId(),
                memberName,
                logEntry.getChannel() == null ? null : logEntry.getChannel().name(),
                logEntry.getType() == null ? null : logEntry.getType().name(),
                logEntry.getContent(),
                logEntry.getStatus() == null ? null : logEntry.getStatus().name(),
                logEntry.getRetryCount(),
                logEntry.getSentAt() == null ? null : logEntry.getSentAt().toString());
    }

    private NotificationLog.NotificationType parseType(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        try {
            return NotificationLog.NotificationType.valueOf(type.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "type", "Loại thông báo không hợp lệ: " + type);
        }
    }

    private NotificationLog.NotificationStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return NotificationLog.NotificationStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "status", "Trạng thái không hợp lệ: " + status);
        }
    }
}
