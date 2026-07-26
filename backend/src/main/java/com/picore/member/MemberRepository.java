package com.picore.member;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {

    boolean existsByPhone(String phone);

    boolean existsByEmail(String email);

    List<Member> findByFullNameContainingIgnoreCaseOrPhoneContaining(String name, String phone);

    Optional<Member> findByPhone(String phone);

    // UC2.2 — tìm hội viên theo tài khoản đăng nhập (lấy từ SecurityContext, không từ param)
    Optional<Member> findByUserAccountId(Long userAccountId);

    // Hội viên chưa được liên kết tài khoản — dùng để chọn khi tạo tài khoản mới
    List<Member> findByUserAccountIsNullAndStatus(Member.Status status);

    // UC3.2 — tìm hội viên đang hoạt động theo tên hoặc SĐT
    @Query("SELECT m FROM Member m WHERE m.status = :status "
            + "AND (LOWER(m.fullName) LIKE LOWER(CONCAT('%', :q, '%')) "
            + "OR m.phone LIKE CONCAT('%', :q, '%')) "
            + "ORDER BY m.fullName ASC")
    List<Member> searchByStatus(@Param("status") Member.Status status, @Param("q") String q);
}
