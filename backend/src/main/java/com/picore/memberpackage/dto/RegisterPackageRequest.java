package com.picore.memberpackage.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record RegisterPackageRequest(
        @NotNull(message = "Không tìm thấy hội viên") Long memberId,
        @NotNull(message = "Loại gói tập không tồn tại hoặc ngừng áp dụng") Long packageTypeId,
        LocalDate startDate
) {
}
