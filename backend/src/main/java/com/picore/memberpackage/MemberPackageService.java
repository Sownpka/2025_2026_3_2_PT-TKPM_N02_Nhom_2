package com.picore.memberpackage;

import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.notification.NotificationService;
import com.picore.memberpackage.dto.MemberPackageResponse;
import com.picore.memberpackage.dto.RegisterPackageRequest;
import com.picore.packageplan.PackageType;
import com.picore.packageplan.PackageTypeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service
public class MemberPackageService {

    // Các loại gói tính theo số buổi → sessions_remaining lấy từ package_type.sessions
    private static final Set<PackageType.PackageCategory> SESSION_BASED = Set.of(
            PackageType.PackageCategory.THEO_BUOI,
            PackageType.PackageCategory.GOI_1_1,
            PackageType.PackageCategory.GOI_1_2
    );

    // Các loại gói riêng (1-1 / 1-2)
    private static final Set<PackageType.PackageCategory> PRIVATE_CATEGORIES = Set.of(
            PackageType.PackageCategory.GOI_1_1,
            PackageType.PackageCategory.GOI_1_2
    );

    private final MemberPackageRepository memberPackageRepository;
    private final PackageTransactionRepository packageTransactionRepository;
    private final MemberRepository memberRepository;
    private final PackageTypeRepository packageTypeRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    public MemberPackageService(MemberPackageRepository memberPackageRepository,
                                PackageTransactionRepository packageTransactionRepository,
                                MemberRepository memberRepository,
                                PackageTypeRepository packageTypeRepository,
                                AuditLogService auditLogService,
                                NotificationService notificationService) {
        this.memberPackageRepository = memberPackageRepository;
        this.packageTransactionRepository = packageTransactionRepository;
        this.memberRepository = memberRepository;
        this.packageTypeRepository = packageTypeRepository;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
    }

    @Transactional
    public MemberPackageResponse registerPackage(RegisterPackageRequest req, Long actorId) {
        // 1. Validate hội viên tồn tại + đang hoạt động
        Member member = memberRepository.findById(req.memberId())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "memberId",
                        "Không tìm thấy hội viên"));
        if (member.getStatus() != Member.Status.ACTIVE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "memberId", "Không tìm thấy hội viên");
        }

        // 2. Validate loại gói tồn tại + đang áp dụng
        PackageType packageType = packageTypeRepository.findById(req.packageTypeId())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "packageTypeId",
                        "Loại gói tập không tồn tại hoặc ngừng áp dụng"));
        if (packageType.getStatus() != PackageType.PackageStatus.ACTIVE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "packageTypeId",
                    "Loại gói tập không tồn tại hoặc ngừng áp dụng");
        }

        // 3. Tìm gói ACTIVE hiện tại (end_date muộn nhất) để xác định NEW vs RENEWAL
        MemberPackage current = memberPackageRepository
                .findFirstByMemberIdAndStatusOrderByEndDateDesc(
                        member.getId(), MemberPackage.MemberPackageStatus.ACTIVE)
                .orElse(null);
        boolean isRenewal = current != null;
        PackageTransaction.TransactionType txType = isRenewal
                ? PackageTransaction.TransactionType.RENEWAL
                : PackageTransaction.TransactionType.NEW;

        // 4. Tính ngày bắt đầu — ưu tiên giá trị client gửi lên, fallback theo quy tắc mặc định
        LocalDate startDate;
        if (req.startDate() != null) {
            startDate = req.startDate();
        } else if (isRenewal) {
            startDate = current.getEndDate().plusDays(1);
        } else {
            startDate = LocalDate.now();
        }

        // 5. Tính ngày hết hạn = ngày bắt đầu + thời hạn gói
        LocalDate endDate = startDate.plusDays(packageType.getDurationDays());

        // 6. Số buổi còn lại (NULL nếu gói theo tháng / không giới hạn)
        Integer sessionsRemaining = SESSION_BASED.contains(packageType.getCategory())
                ? packageType.getSessions()
                : null;

        // 7. Lưu member_package
        MemberPackage mp = new MemberPackage();
        mp.setMember(member);
        mp.setPackageType(packageType);
        mp.setStartDate(startDate);
        mp.setEndDate(endDate);
        mp.setSessionsRemaining(sessionsRemaining);
        mp.setStatus(MemberPackage.MemberPackageStatus.ACTIVE);
        mp = memberPackageRepository.save(mp);

        // 8. Ghi package_transaction (BẮT BUỘC — nguồn doanh thu UC6.1), amount = snapshot giá
        PackageTransaction tx = new PackageTransaction();
        tx.setMemberPackage(mp);
        tx.setMember(member);
        tx.setAmount(packageType.getPrice());
        tx.setType(txType);
        packageTransactionRepository.save(tx);

        // 9. Ghi audit log
        auditLogService.log(actorId, "SELL_PACKAGE", "member_package", mp.getId(),
                "Bán gói: " + packageType.getName()
                        + " cho hội viên: " + member.getFullName()
                        + " — số tiền: " + packageType.getPrice());

        // 10. Gửi email xác nhận đăng ký gói
        final Long mpId = mp.getId();
        final Long memberId = member.getId();
        try {
            notificationService.sendPackageRegistrationEmail(memberId, mpId);
        } catch (RuntimeException ex) {
            // Lỗi gửi mail không làm hỏng giao dịch
        }

        // 11. Trả response (kèm type + amountPaid)
        return toResponse(mp, txType.name(), packageType.getPrice());
    }

    @Transactional(readOnly = true)
    public List<MemberPackageResponse> getMemberPackages(Long memberId) {
        if (!memberRepository.existsById(memberId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "memberId", "Không tìm thấy hội viên");
        }
        return memberPackageRepository.findByMemberIdOrderByStartDateDescIdDesc(memberId).stream()
                .map(mp -> toResponse(mp, null, null))
                .toList();
    }

    private MemberPackageResponse toResponse(MemberPackage mp, String type, Long amountPaid) {
        PackageType pt = mp.getPackageType();
        Member m = mp.getMember();

        boolean isPrivate = PRIVATE_CATEGORIES.contains(pt.getCategory());
        boolean warningSessions = mp.getSessionsRemaining() != null
                && mp.getSessionsRemaining() <= 2;
        boolean warningExpiry = mp.getEndDate().isBefore(LocalDate.now().plusDays(8)); // ≤ 7 ngày

        return new MemberPackageResponse(
                mp.getId(),
                m.getId(),
                m.getFullName(),
                pt.getName(),
                pt.getCategory() != null ? pt.getCategory().name() : null,
                mp.getStartDate().toString(),
                mp.getEndDate().toString(),
                mp.getSessionsRemaining(),
                mp.getStatus().name(),
                type,
                amountPaid,
                isPrivate,
                warningSessions,
                warningExpiry
        );
    }
}
