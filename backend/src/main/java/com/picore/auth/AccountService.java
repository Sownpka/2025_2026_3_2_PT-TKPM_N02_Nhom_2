package com.picore.auth;

import com.picore.auth.dto.AccountResponse;
import com.picore.auth.dto.CreateAccountRequest;
import com.picore.auth.dto.UpdateAccountRequest;
import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.notification.NotificationService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AccountService {

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final UserAccountRepository userAccountRepository;
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    public AccountService(UserAccountRepository userAccountRepository,
                          MemberRepository memberRepository,
                          PasswordEncoder passwordEncoder,
                          AuditLogService auditLogService,
                          NotificationService notificationService) {
        this.userAccountRepository = userAccountRepository;
        this.memberRepository = memberRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> getAllAccounts(String search) {
        List<UserAccount> accounts;
        if (search == null || search.isBlank()) {
            accounts = userAccountRepository.findAll();
        } else {
            String term = search.trim();
            accounts = userAccountRepository
                    .findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(term, term);
        }
        return accounts.stream().map(this::toResponse).toList();
    }

    @Transactional
    public AccountResponse createAccount(CreateAccountRequest req, Long actorId) {
        if (!req.confirmPassword().equals(req.password())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "confirmPassword",
                    "Mật khẩu nhập lại không khớp");
        }

        if (req.password().length() < MIN_PASSWORD_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "password",
                    "Mật khẩu phải có ít nhất 8 ký tự");
        }

        UserAccount.Role role = parseRole(req.role());

        if (userAccountRepository.existsByEmail(req.email())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "email", "Email đã tồn tại");
        }

        UserAccount account = new UserAccount();
        account.setFullName(req.fullName());
        account.setEmail(req.email());
        account.setPhone(req.phone());
        account.setRole(role);
        account.setPasswordHash(passwordEncoder.encode(req.password()));
        account.setStatus(UserAccount.Status.ACTIVE);
        account.setFailedAttempts(0);

        try {
            account = userAccountRepository.saveAndFlush(account);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "email", "Email đã tồn tại");
        }

        // Liên kết hội viên nếu được chỉ định
        if (req.memberId() != null) {
            com.picore.member.Member member = memberRepository.findById(req.memberId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy hội viên"));
            if (member.getUserAccount() != null) {
                throw new ApiException(HttpStatus.CONFLICT, "memberId",
                        "Hội viên này đã có tài khoản đăng nhập");
            }
            member.setUserAccount(account);
            memberRepository.save(member);
        }

        auditLogService.log(actorId, "CREATE_ACCOUNT", "UserAccount", account.getId(),
                "Tạo tài khoản: " + account.getEmail());

        try {
            notificationService.sendActivationEmail(account.getEmail(), account.getFullName(), req.password());
        } catch (RuntimeException ex) {
            // Lỗi gửi mail không được làm hỏng giao dịch
        }

        return toResponse(account);
    }

    @Transactional
    public AccountResponse updateAccount(Long id, UpdateAccountRequest req, Long actorId) {
        UserAccount account = userAccountRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản"));

        UserAccount.Role role = parseRole(req.role());
        account.setFullName(req.fullName());
        account.setPhone(req.phone());
        account.setRole(role);

        if (req.status() != null) {
            UserAccount.Status newStatus = parseAccountStatus(req.status());
            account.setStatus(newStatus);
            Member.Status newMemberStatus = newStatus == UserAccount.Status.ACTIVE
                    ? Member.Status.ACTIVE : Member.Status.INACTIVE;
            memberRepository.findByUserAccountId(account.getId()).ifPresent(member -> {
                member.setStatus(newMemberStatus);
                memberRepository.save(member);
            });
        }

        account = userAccountRepository.save(account);
        auditLogService.log(actorId, "UPDATE_ACCOUNT", "UserAccount", account.getId(),
                "Cập nhật tài khoản: " + account.getEmail());

        return toResponse(account);
    }

    @Transactional
    public AccountResponse toggleStatus(Long id, Long actorId) {
        UserAccount account = userAccountRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản"));

        boolean deactivating = account.getStatus() == UserAccount.Status.ACTIVE;
        UserAccount.Status newAccountStatus = deactivating ? UserAccount.Status.INACTIVE : UserAccount.Status.ACTIVE;
        account.setStatus(newAccountStatus);
        account = userAccountRepository.save(account);

        // Đồng bộ trạng thái hội viên liên kết (nếu có)
        Member.Status newMemberStatus = deactivating ? Member.Status.INACTIVE : Member.Status.ACTIVE;
        memberRepository.findByUserAccountId(account.getId()).ifPresent(member -> {
            member.setStatus(newMemberStatus);
            memberRepository.save(member);
        });

        String action = deactivating ? "DEACTIVATE_ACCOUNT" : "ACTIVATE_ACCOUNT";
        String verb = deactivating ? "Vô hiệu hóa tài khoản: " : "Kích hoạt tài khoản: ";
        auditLogService.log(actorId, action, "UserAccount", account.getId(), verb + account.getEmail());

        return toResponse(account);
    }

    /**
     * Tạo tài khoản hội viên (role=MEMBER) — dùng lại cho UC2.1.
     */
    @Transactional
    public UserAccount createMemberAccount(String email, String fullName) {
        if (userAccountRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "email", "Email đã tồn tại");
        }
        UserAccount account = new UserAccount();
        account.setFullName(fullName);
        account.setEmail(email);
        account.setRole(UserAccount.Role.MEMBER);
        account.setPasswordHash(passwordEncoder.encode("changeme123"));
        account.setStatus(UserAccount.Status.ACTIVE);
        account.setFailedAttempts(0);
        account.setMustChangePassword(true);
        try {
            return userAccountRepository.saveAndFlush(account);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "email", "Email đã tồn tại");
        }
    }

    private UserAccount.Role parseRole(String role) {
        try {
            return UserAccount.Role.valueOf(role);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "role", "Vai trò không hợp lệ");
        }
    }

    private UserAccount.Status parseAccountStatus(String status) {
        try {
            return UserAccount.Status.valueOf(status);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "status", "Trạng thái không hợp lệ");
        }
    }

    private AccountResponse toResponse(UserAccount account) {
        return new AccountResponse(
                account.getId(),
                account.getFullName(),
                account.getEmail(),
                account.getPhone(),
                account.getRole().name(),
                account.getStatus().name(),
                account.getCreatedAt() != null ? account.getCreatedAt().toString() : null
        );
    }
}
