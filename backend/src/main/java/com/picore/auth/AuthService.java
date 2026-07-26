package com.picore.auth;

import com.picore.auth.dto.LoginResponse;
import com.picore.common.exception.ApiException;
import com.picore.common.security.JwtTokenProvider;
import com.picore.notification.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_MINUTES = 5;
    private static final int RESET_TOKEN_TTL_HOURS = 1;
    private static final int MIN_PASSWORD_LENGTH = 8;

    private final UserAccountRepository userAccountRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final NotificationService notificationService;

    public AuthService(UserAccountRepository userAccountRepository,
                       JwtTokenProvider jwtTokenProvider,
                       PasswordEncoder passwordEncoder,
                       NotificationService notificationService) {
        this.userAccountRepository = userAccountRepository;
        this.jwtTokenProvider = jwtTokenProvider;
        this.passwordEncoder = passwordEncoder;
        this.notificationService = notificationService;
    }

    @Transactional
    public LoginResponse login(String email, String password) {
        UserAccount user = userAccountRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED,
                        "Email hoặc mật khẩu không đúng. Vui lòng thử lại."));

        if (user.getStatus() == UserAccount.Status.INACTIVE) {
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
        }

        LocalDateTime now = LocalDateTime.now();
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau 5 phút.");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            if (user.getFailedAttempts() + 1 >= MAX_FAILED_ATTEMPTS) {
                user.setLockedUntil(now.plusMinutes(LOCK_MINUTES));
                user.setFailedAttempts(0);
            } else {
                user.setFailedAttempts(user.getFailedAttempts() + 1);
            }
            userAccountRepository.save(user);
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Email hoặc mật khẩu không đúng. Vui lòng thử lại.");
        }

        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        userAccountRepository.save(user);

        String token = jwtTokenProvider.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new LoginResponse(token, user.getRole().name(), user.getFullName(), user.getEmail(), user.getId());
    }

    @Transactional
    public void forgotPassword(String email) {
        UserAccount user = userAccountRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "email",
                        "Email không tồn tại trong hệ thống."));

        String resetToken = UUID.randomUUID().toString();
        user.setResetToken(resetToken);
        user.setResetTokenExpiresAt(LocalDateTime.now().plusHours(RESET_TOKEN_TTL_HOURS));
        userAccountRepository.save(user);

        notificationService.sendPasswordResetEmail(email, resetToken);
    }

    @Transactional
    public void resetPassword(String token, String newPassword, String confirmPassword) {
        if (!newPassword.equals(confirmPassword)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "confirmPassword",
                    "Mật khẩu nhập lại không khớp.");
        }

        if (newPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "newPassword",
                    "Mật khẩu phải có ít nhất 8 ký tự.");
        }

        UserAccount user = userAccountRepository.findByResetToken(token)
                .filter(u -> u.getResetTokenExpiresAt() != null
                        && u.getResetTokenExpiresAt().isAfter(LocalDateTime.now()))
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                        "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn."));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setResetToken(null);
        user.setResetTokenExpiresAt(null);
        userAccountRepository.save(user);
    }
}
