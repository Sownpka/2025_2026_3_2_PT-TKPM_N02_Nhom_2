package com.picore.memberpackage.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Response chung cho đăng ký gói (POST) và liệt kê gói của hội viên (GET).
 * - POST: điền type + amountPaid (NEW/RENEWAL, số tiền đã thu).
 * - GET danh sách: type/amountPaid = null (ẩn nhờ NON_NULL), tập trung vào cảnh báo.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MemberPackageResponse(
        Long id,
        Long memberId,
        String memberName,
        String packageTypeName,
        String packageCategory,
        String startDate,
        String endDate,
        Integer sessionsRemaining,
        String status,
        String type,
        Long amountPaid,
        boolean isPrivatePackage,
        boolean warningSessions,
        boolean warningExpiry
) {
}
