package com.picore.member;

import com.picore.auth.UserAccount;
import com.picore.auth.UserAccountRepository;
import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.member.dto.ActivePackageInfo;
import com.picore.member.dto.BookingHistoryItem;
import com.picore.member.dto.CreateMemberRequest;
import com.picore.member.dto.MemberDetailResponse;
import com.picore.member.dto.MemberResponse;
import com.picore.member.dto.UpdateMemberRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
public class MemberService {

    private final MemberRepository memberRepository;
    private final UserAccountRepository userAccountRepository;
    private final AuditLogService auditLogService;

    public MemberService(MemberRepository memberRepository,
                         UserAccountRepository userAccountRepository,
                         AuditLogService auditLogService) {
        this.memberRepository = memberRepository;
        this.userAccountRepository = userAccountRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<MemberResponse> getAllMembers(String search) {
        List<Member> members;
        if (search == null || search.isBlank()) {
            members = memberRepository.findAll();
        } else {
            String term = search.trim();
            members = memberRepository
                    .findByFullNameContainingIgnoreCaseOrPhoneContaining(term, term);
        }
        return members.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<MemberResponse> searchActiveMembers(String q) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        return memberRepository.searchByStatus(Member.Status.ACTIVE, q.trim()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public MemberResponse createMember(CreateMemberRequest req, Long actorId) {
        if (memberRepository.existsByPhone(req.phone())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "phone",
                    "Số điện thoại đã tồn tại trong hệ thống.");
        }

        LocalDate dob = parseDob(req.dob());
        Member.Gender gender = parseGender(req.gender());

        Member member = new Member();
        member.setFullName(req.fullName());
        member.setPhone(req.phone());
        member.setEmail(req.email());
        member.setDob(dob);
        member.setGender(gender);
        member.setNote(req.note());
        member.setStatus(Member.Status.ACTIVE);

        try {
            member = memberRepository.saveAndFlush(member);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "phone",
                    "Số điện thoại đã tồn tại trong hệ thống.");
        }

        auditLogService.log(actorId, "CREATE_MEMBER", "Member", member.getId(),
                "Tạo hội viên: " + member.getPhone());

        return toResponse(member);
    }

    @Transactional(readOnly = true)
    public List<MemberResponse> getMembersWithoutAccount() {
        return memberRepository.findByUserAccountIsNullAndStatus(Member.Status.ACTIVE)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public MemberResponse updateMember(Long id, UpdateMemberRequest req, Long actorId) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy hội viên"));

        // Check trùng phone (trừ chính member này)
        String newPhone = req.phone();
        if (!member.getPhone().equals(newPhone) && memberRepository.existsByPhone(newPhone)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "phone",
                    "Số điện thoại đã tồn tại trong hệ thống.");
        }

        LocalDate dob = parseDob(req.dob());
        Member.Gender gender = parseGender(req.gender());

        member.setFullName(req.fullName());
        member.setPhone(newPhone);
        member.setDob(dob);
        member.setGender(gender);
        member.setNote(req.note());

        if (req.status() != null) {
            Member.Status newStatus = parseMemberStatus(req.status());
            member.setStatus(newStatus);
            UserAccount.Status newAccountStatus = newStatus == Member.Status.ACTIVE
                    ? UserAccount.Status.ACTIVE : UserAccount.Status.INACTIVE;
            UserAccount account = member.getUserAccount();
            if (account != null) {
                account.setStatus(newAccountStatus);
                userAccountRepository.save(account);
            }
        }

        try {
            member = memberRepository.saveAndFlush(member);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "phone",
                    "Số điện thoại đã tồn tại trong hệ thống.");
        }

        auditLogService.log(actorId, "UPDATE_MEMBER", "Member", member.getId(),
                "Cập nhật hội viên: " + member.getEmail());

        return toResponse(member);
    }

    @Transactional
    public MemberResponse toggleStatus(Long id, Long actorId) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy hội viên"));

        boolean deactivating = member.getStatus() == Member.Status.ACTIVE;
        member.setStatus(deactivating ? Member.Status.INACTIVE : Member.Status.ACTIVE);

        // Đồng thời toggle tài khoản đăng nhập (cùng transaction)
        UserAccount account = member.getUserAccount();
        if (account != null) {
            account.setStatus(deactivating ? UserAccount.Status.INACTIVE : UserAccount.Status.ACTIVE);
            userAccountRepository.save(account);
        }

        member = memberRepository.save(member);

        String action = deactivating ? "DEACTIVATE_MEMBER" : "ACTIVATE_MEMBER";
        String verb = deactivating ? "Ngừng kích hoạt hội viên: " : "Kích hoạt hội viên: ";
        auditLogService.log(actorId, action, "Member", member.getId(), verb + member.getEmail());

        return toResponse(member);
    }

    @Transactional(readOnly = true)
    public MemberDetailResponse getMemberDetail(Long id) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy hội viên"));

        // member_package (UC3.2) và booking (UC5.1) chưa có entity → trả list rỗng an toàn
        List<ActivePackageInfo> packages = List.of();
        List<BookingHistoryItem> history = List.of();

        return new MemberDetailResponse(toResponse(member), packages, history);
    }

    private LocalDate parseDob(String dob) {
        if (dob == null || dob.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(dob.trim());
        } catch (DateTimeParseException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "dob", "Ngày sinh không hợp lệ");
        }
    }

    private Member.Status parseMemberStatus(String status) {
        try {
            return Member.Status.valueOf(status);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "status", "Trạng thái không hợp lệ");
        }
    }

    private Member.Gender parseGender(String gender) {
        if (gender == null || gender.isBlank()) {
            return null;
        }
        try {
            return Member.Gender.valueOf(gender.trim());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "gender", "Giới tính không hợp lệ");
        }
    }

    private MemberResponse toResponse(Member m) {
        return new MemberResponse(
                m.getId(),
                m.getFullName(),
                m.getPhone(),
                m.getEmail(),
                m.getDob() != null ? m.getDob().toString() : null,
                m.getGender() != null ? m.getGender().name() : null,
                m.getNote(),
                m.getStatus().name(),
                m.getCreatedAt() != null ? m.getCreatedAt().toString() : null
        );
    }
}
