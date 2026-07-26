package com.picore.common;

import com.picore.clazz.ClassSessionRepository;
import com.picore.equipment.Equipment;
import com.picore.equipment.EquipmentRepository;
import com.picore.finance.ExpenseRepository;
import com.picore.member.Member;
import com.picore.member.MemberRepository;
import com.picore.memberpackage.MemberPackage;
import com.picore.memberpackage.MemberPackageRepository;
import com.picore.memberpackage.PackageTransactionRepository;
import com.picore.trainer.TrainerProfile;
import com.picore.trainer.TrainerRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Bảng điều khiển tổng quan (Dashboard) — chỉ dành cho ADMIN.
 * Context-path /api → base path /api/dashboard.
 * Tổng hợp số liệu trực tiếp từ các repository, không có bảng riêng.
 */
@RestController
@RequestMapping("/dashboard")
@PreAuthorize("hasRole('ADMIN')")
public class DashboardController {

    private final MemberRepository memberRepository;
    private final MemberPackageRepository memberPackageRepository;
    private final TrainerRepository trainerRepository;
    private final EquipmentRepository equipmentRepository;
    private final PackageTransactionRepository packageTransactionRepository;
    private final ExpenseRepository expenseRepository;
    private final ClassSessionRepository classSessionRepository;

    public DashboardController(MemberRepository memberRepository,
                               MemberPackageRepository memberPackageRepository,
                               TrainerRepository trainerRepository,
                               EquipmentRepository equipmentRepository,
                               PackageTransactionRepository packageTransactionRepository,
                               ExpenseRepository expenseRepository,
                               ClassSessionRepository classSessionRepository) {
        this.memberRepository = memberRepository;
        this.memberPackageRepository = memberPackageRepository;
        this.trainerRepository = trainerRepository;
        this.equipmentRepository = equipmentRepository;
        this.packageTransactionRepository = packageTransactionRepository;
        this.expenseRepository = expenseRepository;
        this.classSessionRepository = classSessionRepository;
    }

    public record DashboardStats(long totalMembers,
                                 long totalActivePackages,
                                 long totalTrainers,
                                 long totalEquipment,
                                 long revenueThisMonth,
                                 long expenseThisMonth,
                                 long sessionsTodayCount) {
    }

    @GetMapping
    public DashboardStats getStats() {
        LocalDate today = LocalDate.now();
        LocalDate firstDayOfMonth = today.withDayOfMonth(1);
        LocalDate firstDayOfNextMonth = firstDayOfMonth.plusMonths(1);
        LocalDate lastDayOfMonth = firstDayOfNextMonth.minusDays(1);
        LocalDateTime monthStart = firstDayOfMonth.atStartOfDay();
        LocalDateTime monthEnd = firstDayOfNextMonth.atStartOfDay().minusNanos(1);

        long totalMembers = memberRepository.findAll().stream()
                .filter(m -> m.getStatus() == Member.Status.ACTIVE)
                .count();

        long totalActivePackages = memberPackageRepository.findAll().stream()
                .filter(mp -> mp.getStatus() == MemberPackage.MemberPackageStatus.ACTIVE)
                .count();

        long totalTrainers = trainerRepository
                .findAllByStatusOrderByIdAsc(TrainerProfile.TrainerStatus.ACTIVE).size();

        long totalEquipment = equipmentRepository
                .findByStatusOrderByIdAsc(Equipment.EquipmentStatus.ACTIVE).size();

        Long revenue = packageTransactionRepository.sumAmountByCreatedAtBetween(monthStart, monthEnd);
        long revenueThisMonth = revenue == null ? 0L : revenue;

        BigDecimal expense = expenseRepository.sumAmountByExpenseDateBetween(firstDayOfMonth, lastDayOfMonth);
        long expenseThisMonth = expense == null ? 0L : expense.longValue();

        long sessionsTodayCount = classSessionRepository
                .findBySessionDateOrderByStartTimeAsc(today).size();

        return new DashboardStats(
                totalMembers,
                totalActivePackages,
                totalTrainers,
                totalEquipment,
                revenueThisMonth,
                expenseThisMonth,
                sessionsTodayCount);
    }
}
