package com.picore.member.dto;

import java.util.List;

public record MemberDetailResponse(
        MemberResponse member,
        List<ActivePackageInfo> activePackages,
        List<BookingHistoryItem> bookingHistory
) {
}
