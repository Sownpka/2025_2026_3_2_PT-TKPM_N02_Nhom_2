package com.picore.packageplan.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record UpdatePackageTypeRequest(
        @NotBlank(message = "Tên gói không được để trống") String name,
        @NotNull(message = "Phân loại không được để trống") String category,
        Integer sessions,
        @NotNull(message = "Thời hạn không được để trống") @Positive(message = "Thời hạn phải lớn hơn 0") Integer durationDays,
        @NotNull(message = "Giá không được để trống") @Positive(message = "Giá phải lớn hơn 0") Long price,
        String description
) {
}
