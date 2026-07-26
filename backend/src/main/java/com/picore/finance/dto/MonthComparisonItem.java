package com.picore.finance.dto;

import java.math.BigDecimal;

public record MonthComparisonItem(
        String month,
        String monthLabel,
        BigDecimal revenue,
        BigDecimal expense,
        BigDecimal profit
) {}
