package com.picore.notification;

import com.picore.booking.Booking;
import com.picore.booking.BookingRepository;
import com.picore.clazz.ClassSession;
import com.picore.clazz.ClassSessionRepository;
import com.picore.clazz.GymClass;
import com.picore.clazz.GymClassRepository;
import com.picore.trainer.TrainerProfile;
import com.picore.trainer.TrainerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Implementation "mock" của {@link NotificationService} (UC5.4).
 *
 * <p>Dev không gửi email/SMS thật (không cần SendGrid): mỗi lần "gửi" được
 * log ra console và ghi 1 bản ghi vào {@code notification_log}. Đồng thời khi
 * xác nhận đặt lịch sẽ tạo 1 bản ghi {@code scheduled_notification} để nhắc
 * lịch trước 2 giờ.
 *
 * <p>Mọi method đều nuốt exception (không ném ra ngoài) vì caller dùng
 * {@code notifyQuietly()} — lỗi thông báo không được làm hỏng giao dịch đặt lịch.
 */
@Service
@Profile("dev")
public class MockNotificationService implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(MockNotificationService.class);

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    // Nhắc lịch trước 2 giờ so với giờ bắt đầu buổi tập.
    private static final int REMINDER_LEAD_HOURS = 2;

    private final NotificationLogRepository notificationLogRepository;
    private final ScheduledNotificationRepository scheduledNotificationRepository;
    private final BookingRepository bookingRepository;
    private final ClassSessionRepository classSessionRepository;
    private final GymClassRepository gymClassRepository;
    private final TrainerRepository trainerRepository;

    public MockNotificationService(NotificationLogRepository notificationLogRepository,
                                   ScheduledNotificationRepository scheduledNotificationRepository,
                                   BookingRepository bookingRepository,
                                   ClassSessionRepository classSessionRepository,
                                   GymClassRepository gymClassRepository,
                                   TrainerRepository trainerRepository) {
        this.notificationLogRepository = notificationLogRepository;
        this.scheduledNotificationRepository = scheduledNotificationRepository;
        this.bookingRepository = bookingRepository;
        this.classSessionRepository = classSessionRepository;
        this.gymClassRepository = gymClassRepository;
        this.trainerRepository = trainerRepository;
    }

    @Override
    public void sendActivationEmail(String toEmail, String fullName, String tempPassword) {
        log.info("[MOCK EMAIL] Kích hoạt tài khoản → {}: fullName={}, tempPassword={}", toEmail, fullName, tempPassword);
    }

    @Override
    public void sendPackageRegistrationEmail(Long memberId, Long memberPackageId) {
        log.info("[MOCK EMAIL] Đăng ký gói tập → memberId={}, memberPackageId={}", memberId, memberPackageId);
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        log.info("[MOCK EMAIL] Đặt lại mật khẩu → {}: token={}", toEmail, resetToken);
    }

    /**
     * Flow A — Xác nhận đặt lịch ngay sau khi booking thành công.
     * Ghi notification_log (CONFIRM) + tạo scheduled_notification nhắc trước 2 giờ.
     */
    @Override
    public void sendBookingConfirmation(Long memberId, Long bookingId) {
        try {
            Booking booking = bookingRepository.findById(bookingId)
                    .orElseThrow(() -> new IllegalStateException("Không tìm thấy booking id=" + bookingId));
            ClassSession session = classSessionRepository.findById(booking.getClassSessionId())
                    .orElseThrow(() -> new IllegalStateException(
                            "Không tìm thấy buổi tập id=" + booking.getClassSessionId()));

            String className = resolveClassName(session);
            String trainerName = resolveTrainerName(session);
            String content = String.format(
                    "Xác nhận đặt lịch: %s ngày %s lúc %s, HLV: %s",
                    className,
                    session.getSessionDate().format(DATE_FMT),
                    session.getStartTime().format(TIME_FMT),
                    trainerName);

            log.info("[NOTIFY] Gửi xác nhận tới memberId={}: {}", memberId, content);
            saveLog(memberId, NotificationLog.NotificationType.CONFIRM, content,
                    NotificationLog.NotificationStatus.SENT);

            // Tạo lịch nhắc trước 2 giờ. Nếu send_at đã qua (buổi hôm nay sắp bắt đầu)
            // vẫn tạo — scheduler sẽ nhặt ở lần quét kế tiếp và gửi ngay.
            LocalDateTime sessionDateTime =
                    LocalDateTime.of(session.getSessionDate(), session.getStartTime());
            ScheduledNotification sn = new ScheduledNotification();
            sn.setBookingId(bookingId);
            sn.setSendAt(sessionDateTime.minusHours(REMINDER_LEAD_HOURS));
            sn.setSent(false);
            scheduledNotificationRepository.save(sn);
        } catch (Exception ex) {
            log.warn("[NOTIFY] Gửi xác nhận thất bại memberId={}, bookingId={}: {}",
                    memberId, bookingId, ex.getMessage());
            saveLog(memberId, NotificationLog.NotificationType.CONFIRM,
                    "Xác nhận đặt lịch (bookingId=" + bookingId + ")",
                    NotificationLog.NotificationStatus.FAILED);
        }
    }

    /**
     * Nhắc lịch tập theo bookingId (giữ tương thích chữ ký cũ). Ủy quyền cho
     * {@link #sendReminder(ScheduledNotification)}.
     */
    @Override
    public void sendBookingReminder(Long memberId, Long bookingId) {
        ScheduledNotification sn = new ScheduledNotification();
        sn.setBookingId(bookingId);
        sn.setSendAt(LocalDateTime.now());
        sendReminder(sn);
    }

    /**
     * Flow A — Mời hội viên đầu danh sách chờ khi có chỗ trống.
     */
    @Override
    public void sendWaitlistInvite(Long memberId, Long classSessionId) {
        try {
            ClassSession session = classSessionRepository.findById(classSessionId)
                    .orElseThrow(() -> new IllegalStateException(
                            "Không tìm thấy buổi tập id=" + classSessionId));

            String className = resolveClassName(session);
            String content = String.format(
                    "Có chỗ trống cho buổi %s ngày %s lúc %s. Đặt ngay!",
                    className,
                    session.getSessionDate().format(DATE_FMT),
                    session.getStartTime().format(TIME_FMT));

            log.info("[NOTIFY] Gửi waitlist invite tới memberId={}: {}", memberId, content);
            saveLog(memberId, NotificationLog.NotificationType.WAITLIST_INVITE, content,
                    NotificationLog.NotificationStatus.SENT);
        } catch (Exception ex) {
            log.warn("[NOTIFY] Gửi waitlist invite thất bại memberId={}, classSessionId={}: {}",
                    memberId, classSessionId, ex.getMessage());
            saveLog(memberId, NotificationLog.NotificationType.WAITLIST_INVITE,
                    "Mời từ danh sách chờ (classSessionId=" + classSessionId + ")",
                    NotificationLog.NotificationStatus.FAILED);
        }
    }

    /**
     * Flow B — Gửi nhắc lịch trước 2 giờ (được NotificationScheduler gọi).
     */
    @Override
    public void sendReminder(ScheduledNotification sn) {
        Long memberId = null;
        try {
            Booking booking = bookingRepository.findById(sn.getBookingId())
                    .orElseThrow(() -> new IllegalStateException(
                            "Không tìm thấy booking id=" + sn.getBookingId()));
            memberId = booking.getMemberId();
            ClassSession session = classSessionRepository.findById(booking.getClassSessionId())
                    .orElseThrow(() -> new IllegalStateException(
                            "Không tìm thấy buổi tập id=" + booking.getClassSessionId()));

            String className = resolveClassName(session);
            String content = String.format(
                    "Nhắc lịch: %s hôm nay lúc %s, còn %d giờ nữa",
                    className,
                    session.getStartTime().format(TIME_FMT),
                    REMINDER_LEAD_HOURS);

            log.info("[NOTIFY] Gửi nhắc lịch tới memberId={}: {}", memberId, content);
            saveLog(memberId, NotificationLog.NotificationType.REMINDER, content,
                    NotificationLog.NotificationStatus.SENT);
        } catch (Exception ex) {
            log.warn("[NOTIFY] Gửi nhắc lịch thất bại bookingId={}: {}",
                    sn.getBookingId(), ex.getMessage());
            saveLog(memberId, NotificationLog.NotificationType.REMINDER,
                    "Nhắc lịch (bookingId=" + sn.getBookingId() + ")",
                    NotificationLog.NotificationStatus.FAILED);
        }
    }

    // ---- Helpers ----

    private String resolveClassName(ClassSession session) {
        if (session.getGymClassId() != null) {
            return gymClassRepository.findById(session.getGymClassId())
                    .map(GymClass::getName)
                    .orElse("Lớp tập");
        }
        return switch (session.getType()) {
            case PRIVATE_1_1 -> "Buổi 1-1";
            case PRIVATE_1_2 -> "Buổi 1-2";
            default -> "Buổi tập";
        };
    }

    private String resolveTrainerName(ClassSession session) {
        if (session.getTrainerId() == null) {
            return "N/A";
        }
        return trainerRepository.findById(session.getTrainerId())
                .map(TrainerProfile::getUserAccount)
                .map(ua -> ua == null ? null : ua.getFullName())
                .orElse("N/A");
    }

    private void saveLog(Long memberId, NotificationLog.NotificationType type,
                         String content, NotificationLog.NotificationStatus status) {
        try {
            NotificationLog entry = new NotificationLog();
            entry.setMemberId(memberId);
            entry.setChannel(NotificationLog.Channel.EMAIL);
            entry.setType(type);
            entry.setContent(content);
            entry.setStatus(status);
            entry.setRetryCount(0);
            entry.setSentAt(LocalDateTime.now());
            notificationLogRepository.save(entry);
        } catch (Exception ex) {
            log.warn("[NOTIFY] Không ghi được notification_log (type={}, status={}): {}",
                    type, status, ex.getMessage());
        }
    }
}
