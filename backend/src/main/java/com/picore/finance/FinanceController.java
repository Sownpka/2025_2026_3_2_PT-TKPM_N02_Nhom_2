package com.picore.finance;

import com.picore.common.security.UserPrincipal;
import com.picore.finance.dto.CreateExpenseRequest;
import com.picore.finance.dto.ExpenseResponse;
import com.picore.finance.dto.FinanceReportResponse;
import com.picore.finance.dto.MonthComparisonItem;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;
import java.util.List;

/**
 * UC6.1 — Quản lý tài chính. Context-path /api => /api/finance/...
 * Chỉ ADMIN. userId lấy từ JWT (SecurityContext) khi thêm khoản chi.
 */
@RestController
@RequestMapping("/finance")
@PreAuthorize("hasRole('ADMIN')")
public class FinanceController {

    private final FinanceService financeService;

    public FinanceController(FinanceService financeService) {
        this.financeService = financeService;
    }

    @GetMapping("/report")
    public FinanceReportResponse getReport(@RequestParam(defaultValue = "") String month) {
        String m = month.isBlank() ? YearMonth.now().toString() : month;
        return financeService.getReport(m);
    }

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse addExpense(@AuthenticationPrincipal UserPrincipal principal,
                                      @RequestBody CreateExpenseRequest req) {
        return financeService.addExpense(principal.id(), req);
    }

    @PutMapping("/expenses/{id}")
    public ExpenseResponse updateExpense(@PathVariable Long id,
                                         @AuthenticationPrincipal UserPrincipal principal,
                                         @RequestBody CreateExpenseRequest req) {
        return financeService.updateExpense(id, principal.id(), req);
    }

    @DeleteMapping("/expenses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExpense(@PathVariable Long id,
                              @AuthenticationPrincipal UserPrincipal principal) {
        financeService.deleteExpense(id, principal.id());
    }

    @GetMapping("/comparison")
    public List<MonthComparisonItem> getComparison(@RequestParam(defaultValue = "6") int months) {
        return financeService.getComparison(months);
    }
}
