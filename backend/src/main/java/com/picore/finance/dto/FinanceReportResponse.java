package com.picore.finance.dto;

import java.math.BigDecimal;
import java.util.List;

public record FinanceReportResponse(
        String month,
        BigDecimal totalRevenue,
        BigDecimal totalExpense,
        BigDecimal profit,
        List<TransactionItem> transactions,
        List<ExpenseItem> expenses
) {
    public record TransactionItem(
            Long id,
            String memberName,
            String packageTypeName,
            BigDecimal amount,
            String type,
            String createdAt
    ) {}

    public record ExpenseItem(
            Long id,
            String category,
            String categoryLabel,
            BigDecimal amount,
            String expenseDate,
            String note,
            String createdAt
    ) {}
}
