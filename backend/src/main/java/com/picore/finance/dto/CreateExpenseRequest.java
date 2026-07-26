package com.picore.finance.dto;

import java.math.BigDecimal;

public record CreateExpenseRequest(
        String category,
        BigDecimal amount,
        String expenseDate,
        String note
) {}
