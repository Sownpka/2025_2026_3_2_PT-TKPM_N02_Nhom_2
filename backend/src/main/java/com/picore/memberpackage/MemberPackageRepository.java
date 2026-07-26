package com.picore.memberpackage;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MemberPackageRepository extends JpaRepository<MemberPackage, Long> {

    // Gói còn hiệu lực có ngày hết hạn muộn nhất — dùng để xác định NEW vs RENEWAL
    // và tính ngày bắt đầu gói mới khi gia hạn.
    Optional<MemberPackage> findFirstByMemberIdAndStatusOrderByEndDateDesc(
            Long memberId, MemberPackage.MemberPackageStatus status);

    // Tất cả gói của hội viên (mới nhất trước) — cho GET /members/{id}/packages
    List<MemberPackage> findByMemberIdOrderByStartDateDescIdDesc(Long memberId);
}
