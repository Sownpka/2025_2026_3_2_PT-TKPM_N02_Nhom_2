# QA Report — UC2.1 Quản lý hội viên (Backend ↔ Frontend)

**Ngày:** 2026-07-16
**Verifier:** qa-verifier
**Phạm vi:** Tích hợp backend (`com.picore.member`) ↔ frontend (`ReceptionMembersPage` + `api/members.ts`)

---

## Status: PASS (có 3 ghi chú nhỏ, không chặn)

Tất cả điểm kiểm tra bắt buộc trong checklist đều đạt. Shape DTO khớp 1:1, endpoint/method/body khớp, business rule đầy đủ, nhãn tiếng Việt đúng, routing đúng. Các vấn đề tìm thấy đều là edge-case UX/thông báo, không phá vỡ luồng chính.

---

## Passed

### Shape alignment
- **MemberResponse** record (BE) ↔ interface (FE): id, fullName, phone, email, dob, gender, note, status, createdAt — khớp 1:1. `dob`/`gender` nullable ở cả hai (BE trả `String` null-safe qua `toResponse`; FE `string | null` / `Gender | null`). `id` Long↔number OK.
- **POST body**: `CreateMemberPayload` {fullName, phone, email, dob?, gender?, note?} ↔ `CreateMemberRequest` — đủ và đúng tên field.
- **PUT body**: `UpdateMemberPayload` KHÔNG có email ↔ `UpdateMemberRequest` KHÔNG có email. Khớp.
- **PATCH /members/{id}/status**: FE gọi `client.patch(MEMBERS.STATUS(id))` không body; BE `@PatchMapping("/{id}/status")` không `@RequestBody`. Khớp.
- **getMemberDetail**: FE gọi `MEMBERS.HISTORY(id)` = `/members/{id}/history`; BE `@GetMapping("/{id}/history")` → `MemberDetailResponse` {member, activePackages[], bookingHistory[]}. FE parse đúng cả 3 nhánh. `ActivePackageInfo`/`BookingHistoryItem` field khớp (packageName, sessionsRemaining, startDate, endDate, status / className, trainerName, sessionDate, status).

### Business rules
- `createMember`: check `existsByPhone` TRƯỚC, rồi `userAccountRepository.existsByEmail` — đúng thứ tự.
- Tạo `UserAccount` role=MEMBER, `mustChangePassword=true`, `status=ACTIVE`, `failedAttempts=0`, temp password ngẫu nhiên (UUID substring 10), rồi `sendActivationEmail(email, fullName, tempPassword)`. Đủ.
- `toggleStatus`: đổi `member.status` VÀ `userAccount.status` (khi != null) trong CÙNG `@Transactional`. Đúng.
- `@Transactional` trên tất cả write method (create/update/toggle); read dùng `@Transactional(readOnly=true)`. Đúng.
- `@PreAuthorize("hasRole('RECEPTIONIST')")` đặt ở cấp class `MemberController` → áp cho mọi endpoint. Đúng.
- AuditLog: `CREATE_MEMBER` / `UPDATE_MEMBER` / `DEACTIVATE_MEMBER` / `ACTIVATE_MEMBER`, entity="Member". Đúng action theo ngữ cảnh.

### Nhãn tiếng Việt (ReceptionMembersPage.tsx)
- Cột: "Họ tên", "SĐT", "Email", "Ngày sinh", "Giới tính", "Trạng thái", "Thao tác". Đủ.
- Nút thao tác: "Chi tiết" (bg-blue-500), "Sửa" (bg-amber-500), "Xóa" (bg-red-500). Màu đúng. Nút Xóa `disabled` khi status=INACTIVE.
- "+ Thêm hội viên" (bg-teal-600), "Lưu"/"Cập nhật" (theo mode), "Hủy". Đủ.
- Confirm: "Bạn có chắc muốn ngừng kích hoạt hội viên này?" — khớp chính xác.
- Empty: "Không tìm thấy hội viên" (chỉ hiện khi !loading). Đúng.
- Giới tính: "Nam" / "Nữ" / "Khác" / "—" (null). Đúng.
- Modal Chi tiết: "Chưa có gói tập nào", "Chưa có lịch sử tập luyện". Đủ.
- Email readonly khi sửa: `readOnly={isEdit}` + style `bg-gray-50 text-gray-500 cursor-not-allowed`, ẩn hint khi edit. Đúng.

### Routing (App.tsx)
- `/reception/members` bọc trong `<ProtectedRoute allowedRoles={['RECEPTIONIST']}>` → `<Layout>`. Đúng.
- `ReceptionMembersPage` được import (dòng 8) và dùng đúng (dòng 73), thay thế Placeholder cũ.

---

## Issues found (nhỏ, không chặn)

### I-1 (Low) — Luồng kích hoạt lại (ACTIVATE_MEMBER) không thể kích hoạt từ UI
Backend `toggleStatus` hỗ trợ 2 chiều (ACTIVE↔INACTIVE) và ghi audit `ACTIVATE_MEMBER`. Nhưng trên UI, nút "Xóa" (nút duy nhất gọi toggle) bị `disabled` khi `status === 'INACTIVE'`, và không có nút "Kích hoạt lại". Do đó nhánh reactivate của backend không bao giờ được gọi từ màn hình này. Ngoài ra `handleConfirmToggle` hard-code toast "Ngừng kích hoạt hội viên thành công" — nếu sau này thêm nút kích hoạt lại sẽ hiển thị sai. Đây là hạn chế thiết kế (soft-delete một chiều), nên xác nhận với spec xem có cần nút bật lại hay không.

### I-2 (Low) — Lỗi tải Chi tiết bị "nuốt" im lặng
`openDetailModal` bắt lỗi bằng `setFormError(...)`, nhưng JSX của modal Chi tiết (S-3) KHÔNG render `formError`. Khi `getMemberDetail` fail, modal sẽ hết loading, `detail` vẫn null → thân modal trống, người dùng không thấy thông báo lỗi. Nên hiển thị `formError` trong modal detail hoặc dùng toast.

### I-3 (Very low) — Thông báo lỗi trùng có thể sai field ở race-condition
Trong `createMember`, khối `catch (DataIntegrityViolationException)` bao quanh `memberRepository.saveAndFlush(member)` luôn map về field "phone". Entity `Member` có ràng buộc unique cả `phone` LẪN `email`. Nếu vi phạm unique xảy ra do email ở tầng member (đã qua được check `userAccountRepository.existsByEmail`), thông báo sẽ hiển thị nhầm "Số điện thoại đã tồn tại". Xác suất rất thấp vì member+account luôn được tạo cặp và email đã kiểm tra trước; chỉ là thông điệp lỗi có thể gây nhầm.

---

## Recommendations

1. Làm rõ với spec UC2.1: có cần nút "Kích hoạt lại" cho hội viên INACTIVE không. Nếu có → thêm nút + toast động theo trạng thái; nếu không → có thể xoá nhánh ACTIVATE khỏi backend hoặc giữ để dùng cho màn admin sau này.
2. Hiển thị `formError` trong modal Chi tiết (S-3), hoặc chuyển lỗi tải detail sang `toast`, để không bị nuốt lỗi (I-2).
3. (Tùy chọn) Tinh chỉnh thông điệp catch `DataIntegrityViolationException` để phân biệt phone/email (I-3).
4. Bổ sung unit/integration test cho `MemberService`/`MemberController` (đã ghi nhận là TODO trong backend doc) — hiện chưa có test nào cho UC2.1.
5. Nhắc lại từ doc: `activePackages`/`bookingHistory` luôn rỗng cho tới khi UC3.2/UC5.1 có entity — UI đã sẵn sàng render khi backend nối dữ liệu. Không phải lỗi.

---

## Kết luận
Tích hợp UC2.1 backend ↔ frontend **đạt yêu cầu** cho luồng chính (danh sách, tạo, sửa, ngừng kích hoạt, xem chi tiết). Shape/endpoint/nhãn/routing khớp hoàn toàn. Ba ghi chú nhỏ ở trên nên xử lý trong vòng polish nhưng không chặn nghiệm thu.
