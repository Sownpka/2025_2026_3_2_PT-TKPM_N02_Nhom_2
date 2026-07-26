package com.picore.finance.dto;

import java.math.BigDecimal;

public record ExpenseResponse(
        Long id,
        String category,
        String categoryLabel,
        BigDecimal amount,
        String expenseDate,
        String note,
        String createdAt
) {}
