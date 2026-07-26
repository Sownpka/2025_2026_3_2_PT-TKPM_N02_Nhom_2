package com.picore.memberpackage;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface PackageTransactionRepository extends JpaRepository<PackageTransaction, Long> {

    List<PackageTransaction> findByMemberIdOrderByCreatedAtDesc(Long memberId);

    // UC6.1 — giao dịch thu trong khoảng thời gian, fetch sẵn member + packageType
    // để tránh N+1 khi build báo cáo tài chính.
    @Query("SELECT t FROM PackageTransaction t "
            + "JOIN FETCH t.member "
            + "JOIN FETCH t.memberPackage mp "
            + "JOIN FETCH mp.packageType "
            + "WHERE t.createdAt BETWEEN :from AND :to "
            + "ORDER BY t.createdAt DESC")
    List<PackageTransaction> findWithDetailsByCreatedAtBetween(
            @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    // amount là DECIMAL(12,0) map sang Long — SUM trả về Long.
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM PackageTransaction t "
            + "WHERE t.createdAt BETWEEN :from AND :to")
    Long sumAmountByCreatedAtBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
