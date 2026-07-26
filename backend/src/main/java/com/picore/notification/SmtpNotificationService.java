package com.picore.notification;

import com.picore.booking.Booking;
import com.picore.booking.BookingRepository;
import com.picore.clazz.ClassSession;
import com.picore.clazz.ClassSessionRepository;
import com.picore.clazz.GymClass;
import com.picore.clazz.GymClassRepository;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.memberpackage.MemberPackage;
import com.picore.memberpackage.MemberPackageRepository;
import com.picore.trainer.TrainerProfile;
import com.picore.trainer.TrainerRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
@Profile("!dev")
public class SmtpNotificationService implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(SmtpNotificationService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final int REMINDER_LEAD_HOURS = 2;

    @Value("${spring.mail.username}")
    private String fromEmail;

    private final JavaMailSender mailSender;
    private final MemberRepository memberRepository;
    private final MemberPackageRepository memberPackageRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final ScheduledNotificationRepository scheduledNotificationRepository;
    private final BookingRepository bookingRepository;
    private final ClassSessionRepository classSessionRepository;
    private final GymClassRepository gymClassRepository;
    private final TrainerRepository trainerRepository;

    public SmtpNotificationService(JavaMailSender mailSender,
                                   MemberRepository memberRepository,
                                   MemberPackageRepository memberPackageRepository,
                                   NotificationLogRepository notificationLogRepository,
                                   ScheduledNotificationRepository scheduledNotificationRepository,
                                   BookingRepository bookingRepository,
                                   ClassSessionRepository classSessionRepository,
                                   GymClassRepository gymClassRepository,
                                   TrainerRepository trainerRepository) {
        this.mailSender = mailSender;
        this.memberRepository = memberRepository;
        this.memberPackageRepository = memberPackageRepository;
        this.notificationLogRepository = notificationLogRepository;
        this.scheduledNotificationRepository = scheduledNotificationRepository;
        this.bookingRepository = bookingRepository;
        this.classSessionRepository = classSessionRepository;
        this.gymClassRepository = gymClassRepository;
        this.trainerRepository = trainerRepository;
    }

    @Override
    public void sendActivationEmail(String toEmail, String fullName, String tempPassword) {
        String subject = "Chào mừng đến với PiCore — Tài khoản của bạn đã sẵn sàng";
        String html = "<div style='font-family:sans-serif;max-width:520px'>"
                + "<h2 style='color:#0D9488'>Xin chào " + fullName + "!</h2>"
                + "<p>Tài khoản của bạn tại <b>PiCore Pilates</b> đã được tạo.</p>"
                + "<table style='background:#f3f4f6;padding:12px 16px;border-radius:6px;width:100%'>"
                + "<tr><td>Email đăng nhập:</td><td><b>" + toEmail + "</b></td></tr>"
                + "<tr><td>Mật khẩu tạm:</td><td><b style='color:#0D9488'>" + tempPassword + "</b></td></tr>"
                + "</table>"
                + "<p style='color:#6b7280;font-size:13px'>Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.</p>"
                + "</div>";
        sendEmail(toEmail, subject, html);
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        String subject = "Đặt lại mật khẩu PiCore";
        String html = "<div style='font-family:sans-serif;max-width:520px'>"
                + "<h2 style='color:#0D9488'>Đặt lại mật khẩu</h2>"
                + "<p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <b>" + toEmail + "</b>.</p>"
                + "<p>Mã xác nhận của bạn:</p>"
                + "<div style='background:#f3f4f6;padding:12px 16px;border-radius:6px;"
                + "font-size:22px;font-weight:bold;letter-spacing:4px;color:#0D9488'>" + resetToken + "</div>"
                + "<p style='color:#6b7280;font-size:13px'>Mã có hiệu lực trong 15 phút. "
                + "Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>"
                + "</div>";
        sendEmail(toEmail, subject, html);
    }

    @Override
    public void sendBookingConfirmation(Long memberId, Long bookingId) {
        try {
            Booking booking = bookingRepository.findById(bookingId)
                    .orElseThrow(() -> new IllegalStateException("booking not found: " + bookingId));
            ClassSession session = classSessionRepository.findById(booking.getClassSessionId())
                    .orElseThrow(() -> new IllegalStateException("session not found"));

            String className = resolveClassName(session);
            String trainerName = resolveTrainerName(session);
            String content = String.format("Xác nhận đặt lịch: %s ngày %s lúc %s, HLV: %s",
                    className, session.getSessionDate().format(DATE_FMT),
                    session.getStartTime().format(TIME_FMT), trainerName);

            String email = resolveEmail(memberId);
            if (email != null) {
                String html = "<div style='font-family:sans-serif;max-width:520px'>"
                        + "<h2 style='color:#0D9488'>Đặt lịch thành công!</h2>"
                        + "<table style='border-collapse:collapse;width:100%'>"
                        + row("Lớp học", className)
                        + row("Huấn luyện viên", trainerName)
                        + row("Ngày", session.getSessionDate().format(DATE_FMT))
                        + row("Giờ", session.getStartTime().format(TIME_FMT) + " – " + session.getEndTime().format(TIME_FMT))
                        + "</table>"
                        + "<p style='color:#6b7280;font-size:13px'>Hẹn gặp bạn tại phòng tập!</p>"
                        + "</div>";
                sendEmail(email, "Xác nhận đặt lịch — " + className, html);
            }

            saveLog(memberId, NotificationLog.NotificationType.CONFIRM, content,
                    NotificationLog.NotificationStatus.SENT);

            LocalDateTime sessionStart = LocalDateTime.of(session.getSessionDate(), session.getStartTime());
            ScheduledNotification sn = new ScheduledNotification();
            sn.setBookingId(bookingId);
            sn.setSendAt(sessionStart.minusHours(REMINDER_LEAD_HOURS));
            sn.setSent(false);
            scheduledNotificationRepository.save(sn);

        } catch (Exception ex) {
            log.warn("Gửi xác nhận đặt lịch thất bại memberId={}, bookingId={}: {}", memberId, bookingId, ex.getMessage());
            saveLog(memberId, NotificationLog.NotificationType.CONFIRM,
                    "Xác nhận đặt lịch (bookingId=" + bookingId + ")",
                    NotificationLog.NotificationStatus.FAILED);
        }
    }

    @Override
    public void sendBookingReminder(Long memberId, Long bookingId) {
        ScheduledNotification sn = new ScheduledNotification();
        sn.setBookingId(bookingId);
        sn.setSendAt(LocalDateTime.now());
        sendReminder(sn);
    }

    @Override
    public void sendWaitlistInvite(Long memberId, Long classSessionId) {
        try {
            ClassSession session = classSessionRepository.findById(classSessionId)
                    .orElseThrow(() -> new IllegalStateException("session not found: " + classSessionId));

            String className = resolveClassName(session);
            String content = String.format("Có chỗ trống cho buổi %s ngày %s lúc %s. Đặt ngay!",
                    className, session.getSessionDate().format(DATE_FMT),
                    session.getStartTime().format(TIME_FMT));

            String email = resolveEmail(memberId);
            if (email != null) {
                String html = "<div style='font-family:sans-serif;max-width:520px'>"
                        + "<h2 style='color:#0D9488'>Có chỗ trống!</h2>"
                        + "<p>Một chỗ vừa mở cho <b>" + className + "</b> "
                        + "ngày <b>" + session.getSessionDate().format(DATE_FMT) + "</b> "
                        + "lúc <b>" + session.getStartTime().format(TIME_FMT) + "</b>.</p>"
                        + "<p>Đăng nhập ngay để đặt chỗ trước khi hết!</p>"
                        + "</div>";
                sendEmail(email, "Có chỗ trống — " + className, html);
            }

            saveLog(memberId, NotificationLog.NotificationType.WAITLIST_INVITE, content,
                    NotificationLog.NotificationStatus.SENT);
        } catch (Exception ex) {
            log.warn("Gửi waitlist invite thất bại memberId={}: {}", memberId, ex.getMessage());
            saveLog(memberId, NotificationLog.NotificationType.WAITLIST_INVITE,
                    "Mời từ danh sách chờ (sessionId=" + classSessionId + ")",
                    NotificationLog.NotificationStatus.FAILED);
        }
    }

    @Override
    public void sendReminder(ScheduledNotification sn) {
        Long memberId = null;
        try {
            Booking booking = bookingRepository.findById(sn.getBookingId())
                    .orElseThrow(() -> new IllegalStateException("booking not found: " + sn.getBookingId()));
            memberId = booking.getMemberId();
            ClassSession session = classSessionRepository.findById(booking.getClassSessionId())
                    .orElseThrow(() -> new IllegalStateException("session not found"));

            String className = resolveClassName(session);
            String content = String.format("Nhắc lịch: %s hôm nay lúc %s, còn %d giờ nữa",
                    className, session.getStartTime().format(TIME_FMT), REMINDER_LEAD_HOURS);

            String email = resolveEmail(memberId);
            if (email != null) {
                String html = "<div style='font-family:sans-serif;max-width:520px'>"
                        + "<h2 style='color:#0D9488'>Nhắc lịch tập</h2>"
                        + "<p>Bạn có buổi <b>" + className + "</b> hôm nay lúc <b>"
                        + session.getStartTime().format(TIME_FMT) + "</b>.</p>"
                        + "<p>Còn khoảng <b>" + REMINDER_LEAD_HOURS + " giờ</b> nữa — hãy chuẩn bị nhé!</p>"
                        + "</div>";
                sendEmail(email, "Nhắc lịch — " + className + " lúc " + session.getStartTime().format(TIME_FMT), html);
            }

            saveLog(memberId, NotificationLog.NotificationType.REMINDER, content,
                    NotificationLog.NotificationStatus.SENT);
        } catch (Exception ex) {
            log.warn("Gửi nhắc lịch thất bại bookingId={}: {}", sn.getBookingId(), ex.getMessage());
            saveLog(memberId, NotificationLog.NotificationType.REMINDER,
                    "Nhắc lịch (bookingId=" + sn.getBookingId() + ")",
                    NotificationLog.NotificationStatus.FAILED);
        }
    }

    @Override
    public void sendPackageRegistrationEmail(Long memberId, Long memberPackageId) {
        try {
            MemberPackage mp = memberPackageRepository.findById(memberPackageId)
                    .orElseThrow(() -> new IllegalStateException("member_package not found: " + memberPackageId));
            Member member = mp.getMember();
            String email = resolveEmail(memberId);
            if (email == null) return;

            String packageName = mp.getPackageType().getName();
            String startDate = mp.getStartDate().format(DATE_FMT);
            String endDate = mp.getEndDate().format(DATE_FMT);
            String sessions = mp.getSessionsRemaining() != null
                    ? mp.getSessionsRemaining() + " buổi" : "Không giới hạn";

            String html = "<div style='font-family:sans-serif;max-width:520px'>"
                    + "<h2 style='color:#0D9488'>Đăng ký gói tập thành công!</h2>"
                    + "<p>Xin chào <b>" + member.getFullName() + "</b>,</p>"
                    + "<p>Gói tập của bạn đã được kích hoạt:</p>"
                    + "<table style='border-collapse:collapse;width:100%'>"
                    + row("Gói tập", packageName)
                    + row("Ngày bắt đầu", startDate)
                    + row("Ngày hết hạn", endDate)
                    + row("Số buổi", sessions)
                    + "</table>"
                    + "<p style='color:#6b7280;font-size:13px'>Chúc bạn tập luyện hiệu quả!</p>"
                    + "</div>";

            sendEmail(email, "Xác nhận đăng ký gói tập — " + packageName, html);

            String content = String.format("Đăng ký gói: %s, từ %s đến %s", packageName, startDate, endDate);
            saveLog(memberId, NotificationLog.NotificationType.CONFIRM, content,
                    NotificationLog.NotificationStatus.SENT);
        } catch (Exception ex) {
            log.warn("Gửi email đăng ký gói thất bại memberId={}, memberPackageId={}: {}",
                    memberId, memberPackageId, ex.getMessage());
        }
    }

    // ---- Helpers ----

    private void sendEmail(String to, String subject, String htmlBody) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(msg);
            log.info("[EMAIL] Gửi tới {}: {}", to, subject);
        } catch (MessagingException ex) {
            log.error("[EMAIL] Gửi thất bại tới {}: {}", to, ex.getMessage());
            throw new RuntimeException("Gửi email thất bại", ex);
        }
    }

    private String resolveEmail(Long memberId) {
        return memberRepository.findById(memberId).map(member -> {
            if (member.getEmail() != null) return member.getEmail();
            if (member.getUserAccount() != null) return member.getUserAccount().getEmail();
            return null;
        }).orElse(null);
    }

    private String resolveClassName(ClassSession session) {
        if (session.getGymClassId() != null) {
            return gymClassRepository.findById(session.getGymClassId())
                    .map(GymClass::getName).orElse("Lớp tập");
        }
        return switch (session.getType()) {
            case PRIVATE_1_1 -> "Buổi 1-1";
            case PRIVATE_1_2 -> "Buổi 1-2";
            default -> "Buổi tập";
        };
    }

    private String resolveTrainerName(ClassSession session) {
        if (session.getTrainerId() == null) return "N/A";
        return trainerRepository.findById(session.getTrainerId())
                .map(TrainerProfile::getUserAccount)
                .map(ua -> ua == null ? null : ua.getFullName())
                .orElse("N/A");
    }

    private static String row(String label, String value) {
        return "<tr><td style='padding:6px 8px;color:#6b7280;border-bottom:1px solid #e5e7eb'>"
                + label + "</td><td style='padding:6px 8px;font-weight:600;border-bottom:1px solid #e5e7eb'>"
                + value + "</td></tr>";
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
            log.warn("Không ghi được notification_log: {}", ex.getMessage());
        }
    }
}
