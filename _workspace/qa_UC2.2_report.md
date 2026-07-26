# QA Report — UC2.2 (Xem gói tập & lịch sử tập)

## PASS / FAIL (overall)

**PASS** (WARNING đã được fix — 0 issue còn lại, chỉ còn INFO). Tích hợp backend ↔ frontend đúng shape, đúng phân quyền, đúng nhãn tiếng Việt. Không có lỗi CRITICAL. Toàn bộ dependency của `MeService` tồn tại và biên dịch được; `@EnableMethodSecurity` đã bật nên `@PreAuthorize` có hiệu lực.

## Issues

- **[WARNING]** Badge `nearExpiry` bật nhầm cho gói đã kết thúc — `MeService.java:130-133`.
  `nearByExpiry = ChronoUnit.DAYS.between(today, endDate) <= 7`: với gói **EXPIRED** (endDate ở quá khứ) giá trị âm → luôn `<= 7` → `nearExpiry = true`. Tương tự gói **USED_UP** có `sessionsRemaining = 0 <= 2` → cũng `true`. Kết quả: UI hiển thị "⚠ Sắp hết" trên gói đã hết hạn / hết buổi — sai ngữ nghĩa. Nên chỉ áp dụng cảnh báo cho gói `status == ACTIVE` (ví dụ `if (mp.getStatus() == ACTIVE) { ... } else nearExpiry = false`).

- **[INFO]** Spec BR2 yêu cầu điều kiện số buổi chỉ áp dụng khi `category ∈ {THEO_BUOI, GOI_1_1, GOI_1_2}`, nhưng backend (`MeService.java:130`) chỉ kiểm `sessionsRemaining <= 2` không kiểm category. Thực tế **được giảm nhẹ** vì gói THEO_THANG/KHONG_GIOI_HAN có `sessionsRemaining = null` (đã có null-check) nên không kích hoạt. Rủi ro thấp, nhưng nếu dữ liệu bất thường (gói theo tháng lại set sessionsRemaining) sẽ gắn badge sai. Frontend `sessionLabel` (MemberHistoryPage.tsx:53-58) thì kiểm category đúng.

- **[INFO]** Lệch nullability `trainerName` — `MeService.java:154` có thể trả `null` (khi không tìm thấy trainer hoặc userAccount null), nhưng type TS `MyHistoryItem.trainerName: string` (me.ts:24) khai báo non-null. Không gây crash (React render null thành rỗng), nhưng nên đổi thành `string | null` cho đúng.

- **[INFO]** Nhãn card gói lệch nhẹ so với gợi ý design-system: spec ghi nhãn "Bắt đầu"/"Hết hạn"/"Còn lại"; UI dùng "Ngày bắt đầu"/"Ngày hết hạn" và gộp "Còn lại: X buổi" (MemberHistoryPage.tsx:196,201,205). Chấp nhận được (design-system chỉ là hướng dẫn), không phải lỗi.

- **[INFO]** Spec gợi ý dùng React Query; implementation dùng `useState`/`useEffect` thủ công (có cleanup `active` flag chống race đúng cách). Khác cách làm, không ảnh hưởng chức năng.

## Checklist kết quả

- [x] **Shape alignment OK** — `MyPackageResponse` (id/packageTypeName/category/sessionsRemaining/startDate/endDate/status/nearExpiry) và `MyHistoryItem` (sessionDate/className/trainerName/startTime/endTime/attendanceStatus) khớp field và kiểu với `me.ts` + `MemberHistoryPage`. Enum string (category `PackageCategory`, status `MyPackageStatus`, attendanceStatus `ATTENDED|NO_SHOW`) khớp union TS. Chỉ có `trainerName` lệch nullability (INFO).
- [x] **Security OK** — `@PreAuthorize("hasRole('MEMBER')")` ở cấp class `MeController:24`; dùng `principal.id()` từ `@AuthenticationPrincipal UserPrincipal` (không nhận memberId từ client); `requireMember` dùng `memberRepository.findByUserAccountId(userId)` (MeService:198). `@EnableMethodSecurity` bật (SecurityConfig:22), `anyRequest().authenticated()` phủ `/me`.
- [~] **Business rules** — `nearExpiry` (1 WARNING về gói EXPIRED/USED_UP + 1 INFO về category); sắp xếp gói ACTIVE trước rồi startDate DESC **OK** (sort ổn định trên repo `...OrderByStartDateDescIdDesc`); history chỉ ATTENDED+NO_SHOW **OK** (JPQL `status IN (...)`); WEEK từ Monday `today.with(DayOfWeek.MONDAY)` **OK**; MONTH từ ngày 1 `today.withDayOfMonth(1)` **OK**; CUSTOM validate cả `from`+`to` và `from<=to` **OK**; sort history `sessionDate DESC, startTime DESC` **OK**.
- [x] **UI/UX theo spec OK** — route `/member/history` dùng `MemberHistoryPage` thật (App.tsx:88, không còn Placeholder); empty packages "Chưa đăng ký gói tập nào" + "Vui lòng liên hệ lễ tân để đăng ký gói tập."; empty history "Chưa có buổi tập nào được ghi nhận"; badge "⚠ Sắp hết"; status pill ACTIVE/EXPIRED/USED_UP = "Đang hoạt động"/"Đã hết hạn"/"Hết buổi"; attendance pill "Đã tập"/"No-show"; CUSTOM hiện 2 input date; header title "Gói tập & Lịch sử tập luyện" (Layout.tsx:18); ProtectedRoute `allowedRoles={['MEMBER']}` (App.tsx:86).
- [x] **Booking entity stub OK** — đủ fields id, classSessionId, memberId, memberPackageId, status enum(BOOKED,CANCELLED,ATTENDED,NO_SHOW), bookedAt, cancelledAt, checkedInAt. Enum khớp JPQL `findHistory` (BookingRepository:22-23).
- [x] **Labels tiếng Việt OK** — cột bảng "Ngày | Lớp học | Huấn luyện viên | Giờ | Trạng thái" đúng spec; nút "Lọc", nhãn "Khoảng thời gian/Từ ngày/Đến ngày", dropdown "Tuần này/Tháng này/Tùy chọn" đúng. Lệch nhẹ nhãn card gói (INFO).

## Ghi chú

- `resolveRange` dùng `today` làm cận trên cho WEEK/MONTH → buổi tương lai trong tuần/tháng không hiện. Vô hại vì lịch sử chỉ gồm buổi đã ATTENDED/NO_SHOW (quá khứ).
- Endpoint khớp: controller `/me` + context-path `/api` → `/api/me/packages|history`; frontend `ME.PACKAGES='/me/packages'`, `ME.HISTORY='/me/history'` (baseURL client đã gồm `/api` như các module khác).
- Batch-load ClassSession/GymClass/Trainer trong `getMyHistory` tránh N+1, giữ thứ tự từ query booking — tốt.
- Booking/ClassSession là entity stub (UC5.1/UC5.3 populate sau) → `/me/history` hiện trả rỗng cho tới khi có dữ liệu; đúng như ghi chú trong code.
