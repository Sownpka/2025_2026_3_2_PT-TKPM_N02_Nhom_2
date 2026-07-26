package com.picore.finance;

import com.picore.common.audit.AuditLogService;
import com.picore.common.exception.ApiException;
import com.picore.finance.dto.CreateExpenseRequest;
import com.picore.finance.dto.ExpenseResponse;
import com.picore.finance.dto.FinanceReportResponse;
import com.picore.finance.dto.MonthComparisonItem;
import com.picore.memberpackage.PackageTransaction;
import com.picore.memberpackage.PackageTransactionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * UC6.1 — Quản lý tài chính (ADMIN).
 * Doanh thu lấy tự động từ package_transaction (UC3.2); chi phí từ bảng expense.
 */
@Service
@Transactional(readOnly = true)
public class FinanceService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;

    private final PackageTransactionRepository transactionRepository;
    private final ExpenseRepository expenseRepository;
    private final AuditLogService auditLogService;

    public FinanceService(PackageTransactionRepository transactionRepository,
                          ExpenseRepository expenseRepository,
                          AuditLogService auditLogService) {
        this.transactionRepository = transactionRepository;
        this.expenseRepository = expenseRepository;
        this.auditLogService = auditLogService;
    }

    public FinanceReportResponse getReport(String month) {
        YearMonth ym = parseMonth(month);
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.of(23, 59, 59));

        BigDecimal totalRevenue = revenueBetween(fromDt, toDt);
        BigDecimal totalExpense = expenseBetween(from, to);
        BigDecimal profit = totalRevenue.subtract(totalExpense);

        List<FinanceReportResponse.TransactionItem> transactions =
                transactionRepository.findWithDetailsByCreatedAtBetween(fromDt, toDt).stream()
                        .map(this::toTransactionItem)
                        .toList();

        List<FinanceReportResponse.ExpenseItem> expenses =
                expenseRepository.findByExpenseDateBetweenOrderByExpenseDateDesc(from, to).stream()
                        .map(this::toExpenseItem)
                        .toList();

        return new FinanceReportResponse(
                ym.toString(), totalRevenue, totalExpense, profit, transactions, expenses);
    }

    @Transactional
    public ExpenseResponse addExpense(Long userId, CreateExpenseRequest req) {
        Expense expense = new Expense();
        expense.setCategory(parseCategory(req.category()));
        expense.setAmount(validateAmount(req.amount()));
        expense.setExpenseDate(parseDate(req.expenseDate()));
        expense.setNote(req.note());
        expense.setCreatedBy(userId);
        expense.setCreatedAt(LocalDateTime.now());
        Expense saved = expenseRepository.save(expense);
        auditLogService.log(userId, "ADD_EXPENSE", "expense", saved.getId(),
                saved.getCategory() + " " + saved.getAmount());
        return toExpenseResponse(saved);
    }

    @Transactional
    public ExpenseResponse updateExpense(Long id, Long userId, CreateExpenseRequest req) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy khoản chi."));
        expense.setCategory(parseCategory(req.category()));
        expense.setAmount(validateAmount(req.amount()));
        expense.setExpenseDate(parseDate(req.expenseDate()));
        expense.setNote(req.note());
        Expense saved = expenseRepository.save(expense);
        auditLogService.log(userId, "UPDATE_EXPENSE", "expense", id, "Cập nhật khoản chi id=" + id);
        return toExpenseResponse(saved);
    }

    @Transactional
    public void deleteExpense(Long id, Long userId) {
        if (!expenseRepository.existsById(id)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy khoản chi.");
        }
        auditLogService.log(userId, "DELETE_EXPENSE", "expense", id, "Xóa khoản chi id=" + id);
        expenseRepository.deleteById(id);
    }

    public List<MonthComparisonItem> getComparison(int months) {
        int span = months > 0 ? months : 6;
        YearMonth current = YearMonth.now();
        List<MonthComparisonItem> result = new ArrayList<>();
        // Từ cũ → mới: current.minus(span-1) ... current
        for (int i = span - 1; i >= 0; i--) {
            YearMonth ym = current.minusMonths(i);
            LocalDate from = ym.atDay(1);
            LocalDate to = ym.atEndOfMonth();
            LocalDateTime fromDt = from.atStartOfDay();
            LocalDateTime toDt = to.atTime(LocalTime.of(23, 59, 59));

            BigDecimal revenue = revenueBetween(fromDt, toDt);
            BigDecimal expense = expenseBetween(from, to);
            BigDecimal profit = revenue.subtract(expense);
            String label = "T" + ym.getMonthValue() + "/" + ym.getYear();

            result.add(new MonthComparisonItem(ym.toString(), label, revenue, expense, profit));
        }
        return result;
    }

    // ---------- helpers ----------

    private BigDecimal revenueBetween(LocalDateTime from, LocalDateTime to) {
        Long sum = transactionRepository.sumAmountByCreatedAtBetween(from, to);
        return sum == null ? BigDecimal.ZERO : BigDecimal.valueOf(sum);
    }

    private BigDecimal expenseBetween(LocalDate from, LocalDate to) {
        BigDecimal sum = expenseRepository.sumAmountByExpenseDateBetween(from, to);
        return sum == null ? BigDecimal.ZERO : sum;
    }

    private YearMonth parseMonth(String month) {
        try {
            return YearMonth.parse(month);
        } catch (DateTimeParseException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tháng không hợp lệ. Định dạng YYYY-MM.");
        }
    }

    private LocalDate parseDate(String date) {
        if (date == null || date.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "expenseDate", "Ngày chi không được để trống.");
        }
        try {
            return LocalDate.parse(date, DATE_FMT);
        } catch (DateTimeParseException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "expenseDate", "Ngày chi không hợp lệ. Định dạng yyyy-MM-dd.");
        }
    }

    private Expense.ExpenseCategory parseCategory(String category) {
        if (category == null || category.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "category", "Loại chi phí không được để trống.");
        }
        try {
            return Expense.ExpenseCategory.valueOf(category);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "category", "Loại chi phí không hợp lệ.");
        }
    }

    private BigDecimal validateAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "amount", "Số tiền phải lớn hơn 0");
        }
        return amount;
    }

    private FinanceReportResponse.TransactionItem toTransactionItem(PackageTransaction t) {
        return new FinanceReportResponse.TransactionItem(
                t.getId(),
                t.getMember().getFullName(),
                t.getMemberPackage().getPackageType().getName(),
                BigDecimal.valueOf(t.getAmount()),
                t.getType().name(),
                t.getCreatedAt() == null ? null : t.getCreatedAt().toString());
    }

    private FinanceReportResponse.ExpenseItem toExpenseItem(Expense e) {
        return new FinanceReportResponse.ExpenseItem(
                e.getId(),
                e.getCategory().name(),
                e.getCategory().toLabel(),
                e.getAmount(),
                e.getExpenseDate().toString(),
                e.getNote(),
                e.getCreatedAt() == null ? null : e.getCreatedAt().toString());
    }

    private ExpenseResponse toExpenseResponse(Expense e) {
        return new ExpenseResponse(
                e.getId(),
                e.getCategory().name(),
                e.getCategory().toLabel(),
                e.getAmount(),
                e.getExpenseDate().toString(),
                e.getNote(),
                e.getCreatedAt() == null ? null : e.getCreatedAt().toString());
    }
}
