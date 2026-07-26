## QA Report: UC3.2 — Đăng ký & gia hạn gói tập

### Status: PASS
Tích hợp backend ↔ frontend đúng và nhất quán. Không phát hiện lỗi chức năng/data (HIGH) hoặc sai label (MEDIUM). Chỉ còn vài gap nhỏ (LOW) đã được đội dev ghi nhận trước hoặc ít rủi ro thực tế.

---

### Issues found

| # | Severity | File:Line | Description | Fix suggestion |
|---|----------|-----------|-------------|----------------|
| 1 | LOW | `MemberPackageResponse.java:10` + `types/memberPackage.ts:19` | `@JsonInclude(NON_NULL)` khiến `sessionsRemaining` bị **loại khỏi JSON** (không phải `null`) với gói unlimited. TS khai báo `sessionsRemaining: number \| null` (required) nên thực tế nhận `undefined`. Không crash vì UI dùng `== null` (bắt cả `undefined`) ở `RegisterPackagePage.tsx:273`. | Đổi TS thành `sessionsRemaining?: number \| null` cho đúng ngữ nghĩa; hoặc bỏ `NON_NULL` cho riêng field này. Không bắt buộc — runtime đã an toàn. |
| 2 | LOW | `RegisterPackageRequest.java:10` + `GlobalExceptionHandler.java:37` | Error `{ field: "startDate", message: "Ngày bắt đầu không hợp lệ" }` (spec dòng 139) **chưa được wire**. `startDate` kiểu `LocalDate` → ngày sai định dạng rơi vào `HttpMessageNotReadableException` → handler `Exception` trả 500 "Đã xảy ra lỗi hệ thống", không map về field. | Rủi ro thấp vì FE luôn sinh ISO hợp lệ (`todayIso`/`addDays`). Nếu cần đúng spec: đổi field sang `String` + parse thủ công như `MemberService.parseDob`, ném `ApiException(BAD_REQUEST,"startDate",...)`. |
| 3 | LOW | `RegisterPackagePage.tsx:118-121` | S-1 "Tạo hội viên mới" chỉ `navigate('/reception/members')`, **chưa auto-fill lại hội viên vừa tạo** vào form (spec S-1 dòng 28). Đây là GAP THẬT, không phải bug — FE đã ghi TODO. | Chờ UC2.1 hỗ trợ trả member vừa tạo (query param / state) rồi nối lại. Để mở rộng sau. |
| 4 | LOW | `MemberPackageService.java` (toàn bộ) | Không có cơ chế chuyển gói cũ ACTIVE → EXPIRED khi gia hạn. Sau RENEWAL, hội viên có **≥2 gói ACTIVE** cùng lúc; FE `find(status==='ACTIVE')` chỉ hiện gói `startDate` mới nhất (`RegisterPackagePage.tsx:77-80`). Chấp nhận được trong phạm vi UC3.2. | Cân nhắc scheduler flip status theo `end_date` (ngoài phạm vi UC3.2, liên quan R3.4/UC6.1). |

---

### Passed checks

**1. Shape alignment (field-by-field)**
- 14/14 field của `MemberPackageResponse` (record) có mặt trong TS interface `MemberPackageResponse`, thứ tự & tên khớp.
- Kiểu khớp: `Long → number`, `LocalDate` được serialize thành `String` (backend `.toString()`, dòng 152-153) → TS `string`; enum `.name()` → union type; `price/amount` là `Long → number`.
- `sessionsRemaining: number | null` — backend trả `null` cho THEO_THANG/KHONG_GIOI_HAN; FE xử lý an toàn bằng `== null` (không crash). Xem Issue #1 về ngữ nghĩa type.
- `isPrivatePackage: boolean` — có trong TS, dùng ở `RegisterPackagePage.tsx:146` để hiện thông báo S-3. (Record boolean component `isPrivatePackage` → Jackson serialize đúng key `isPrivatePackage` cho record.)
- `warningSessions`/`warningExpiry: boolean` — có trong TS, render badge cam/vàng ở `RegisterPackagePage.tsx:252-261`.
- `type: 'NEW' | 'RENEWAL'` — tồn tại ở cả backend response (dòng 124) và TS (`TransactionType`).
- `amountPaid` — tên field **khớp 2 phía** (backend `amountPaid: Long`, FE `amountPaid?: number`). FE chưa hiển thị số tiền sau đăng ký nhưng spec không yêu cầu.
- Error response `{ field, message }` — `ErrorResponse` (single, ApiException) và `List<ErrorResponse>` (validation). `parseApiError` (`api/auth.ts:35`) unpack đúng cả 2 dạng; FE map field → hiển thị dưới đúng ô (`memberId`, `packageTypeId`).

**2. Business rules (Service.java)**
- `package_transaction` ghi bắt buộc mỗi lần đăng ký: `packageTransactionRepository.save(tx)` (dòng 115).
- Snapshot giá: `tx.setAmount(packageType.getPrice())` (dòng 113) — lấy từ entity tại thời điểm giao dịch, không hard-code.
- RENEWAL: `startDate = current.getEndDate().plusDays(1)` khi có gói ACTIVE (dòng 84-89), không theo ngày giao dịch.
- `sessionsRemaining = null` cho THEO_THANG & KHONG_GIOI_HAN (SESSION_BASED chỉ gồm THEO_BUOI/GOI_1_1/GOI_1_2, dòng 23-27, 95-97).
- `audit_log`: `auditLogService.log(actorId, "SELL_PACKAGE", "member_package", mp.getId(), detail)` (dòng 118-121), detail = tên gói + tên hội viên + số tiền — khớp spec.
- `@Transactional` trên `registerPackage` (dòng 53).
- Soft delete: `MemberPackage` dùng enum `status {ACTIVE,EXPIRED,USED_UP}`, không có `@SQLDelete`/xóa vật lý. `package_transaction` cố ý bất biến (đúng — bản ghi giao dịch).

**3. Phân quyền**
- `MemberPackageController` `@PreAuthorize("hasRole('RECEPTIONIST')")` ở cấp class → phủ cả POST `/member-packages` và GET `/members/{id}/packages`.
- `GET /members/search` nằm trong `MemberController` (đã `@PreAuthorize RECEPTIONIST` cấp class).
- FE route `/reception/register-package` nằm trong `<ProtectedRoute allowedRoles={['RECEPTIONIST']}>` (`App.tsx:70-76`).

**4. Vietnamese labels** — tất cả khớp nguyên văn:
- Nút "Tìm" ✓ (đổi "Đang tìm..." khi loading).
- Nút "Xác nhận đăng ký" ✓.
- "Không tìm thấy hội viên" ✓ (cả UI S-1 và message backend).
- "Tạo hội viên mới" ✓.
- Toast "Đăng ký gói tập thành công!" ✓.
- S-3 gói 1-1/1-2: "Hội viên cần tự đăng ký lịch tập hằng tuần qua chức năng Đặt buổi 1-1/1-2 trước hạn chót." ✓.
- Banner S-2 gia hạn: "Hội viên đang có gói còn hiệu lực. Bạn có chắc muốn đăng ký thêm không?" ✓.
- Tiền: `formatVnd` dùng `Intl.NumberFormat('vi-VN').format(amount) + ' ₫'` (`RegisterPackagePage.tsx:18-20`) → `1.500.000 ₫` ✓.

**5. Vấn đề frontend-dev ghi nhận — đã kiểm tra thực tế**
- Dropdown gói tập dùng `packageTypesApi.getActive()` → `GET /package-types/active`. **RECEPTIONIST CÓ quyền**: `PackageTypeController.getActive()` `@PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")` (dòng 40). Lo ngại 403 → dropdown rỗng **không xảy ra**. RESOLVED.
- S-1 auto-fill sau tạo hội viên mới: xác nhận là **gap thật** (Issue #3), không phải bug.

---

### Recommendations
- (Issue #1) Chỉnh TS `sessionsRemaining?: number | null` để phản ánh đúng việc field bị omit khi unlimited — tránh nhầm lẫn cho dev sau.
- (Issue #4) Khi làm UC6.1/R3.4, bổ sung job/logic chuyển ACTIVE → EXPIRED/USED_UP theo `end_date`/`sessions_remaining`, tránh tồn tại nhiều gói ACTIVE song song.
- `warningExpiry = endDate.isBefore(today.plusDays(8))` sẽ true cả với gói đã quá hạn (endDate quá khứ) nếu status vẫn ACTIVE — hệ quả của việc chưa có cơ chế expire ở trên; không ảnh hưởng UC3.2 hiện tại.
- FE có thể hiển thị `amountPaid`/biên nhận sau khi đăng ký thành công (dữ liệu đã có trong response) để lễ tân xác nhận số tiền đã thu — nice-to-have, spec không bắt buộc.
- Flyway chưa bật (backend note): `V1__create_member_package_tables.sql` hiện là tài liệu schema, DDL do Hibernate quản lý. Không ảnh hưởng tích hợp API nhưng cần lưu ý trước khi lên prod (`ddl-auto: validate`).
