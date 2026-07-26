## Backend done: UC2.1 — Quản lý hội viên

### Files created/modified
Tất cả file MỚI trong `backend/src/main/java/com/picore/member/`:
- `Member.java` — JPA entity (NO Lombok), bảng `member`, nested enum `Gender`(MALE/FEMALE/OTHER) + `Status`(ACTIVE/INACTIVE), `@OneToOne` tới `UserAccount` qua `user_account_id` (unique), `@PrePersist` set `createdAt`.
- `MemberRepository.java` — `JpaRepository<Member, Long>` + `existsByPhone`, `existsByEmail`, `findByFullNameContainingIgnoreCaseOrPhoneContaining`, `findByPhone`.
- `MemberService.java` — `@Service`, logic nghiệp vụ (chi tiết bên dưới).
- `MemberController.java` — `@RestController @RequestMapping("/members") @PreAuthorize("hasRole('RECEPTIONIST')")`.
- `dto/MemberResponse.java` (record)
- `dto/MemberDetailResponse.java` (record)
- `dto/ActivePackageInfo.java` (record)
- `dto/BookingHistoryItem.java` (record)
- `dto/CreateMemberRequest.java` (record, validation)
- `dto/UpdateMemberRequest.java` (record, validation)

Không sửa file có sẵn. `AccountService.createMemberAccount` KHÔNG dùng lại — logic tạo tài khoản MEMBER (temp password + NotificationService) implement trực tiếp trong `MemberService.createMember` theo yêu cầu.

Build: `mvn compile` → BUILD SUCCESS. `@EnableMethodSecurity` đã bật sẵn trong `SecurityConfig` nên `@PreAuthorize` hoạt động.

### API endpoints (tất cả yêu cầu ROLE_RECEPTIONIST)
```
GET   /members?search=       → 200 List<MemberResponse>
POST  /members               → 201 MemberResponse
PUT   /members/{id}          → 200 MemberResponse
PATCH /members/{id}/status   → 200 MemberResponse  (toggle ACTIVE↔INACTIVE, soft-delete)
GET   /members/{id}/history  → 200 MemberDetailResponse
```
`actorId` lấy từ `((UserPrincipal) auth.getPrincipal()).id()`.

### Request/Response shapes
CreateMemberRequest: `@NotBlank fullName`, `@NotBlank phone`, `@NotBlank @Email email`, `dob?`, `gender?`, `note?`
UpdateMemberRequest: `@NotBlank fullName`, `@NotBlank phone`, `dob?`, `gender?`, `note?` (email KHÔNG sửa được — không có trong request)
MemberResponse: `id, fullName, phone, email, dob(String?), gender(String?), note, status, createdAt`
MemberDetailResponse: `member, activePackages[], bookingHistory[]`
ActivePackageInfo: `id, packageName, sessionsRemaining, startDate, endDate, status`
BookingHistoryItem: `id, className, trainerName, sessionDate, status`

### Business rules enforced
1. Trùng SĐT khi tạo → 400 field=`phone` "Số điện thoại đã tồn tại trong hệ thống."
2. Trùng email khi tạo (check `userAccountRepository.existsByEmail`) → 400 field=`email` "Email đã tồn tại".
3. Tạo tài khoản MEMBER tự động: temp password `UUID...substring(0,10)`, `passwordHash=encode(temp)`, `mustChangePassword=true`, `status=ACTIVE`, `failedAttempts=0`; sau đó `member.setUserAccount(saved)` và save lại member.
4. `notificationService.sendActivationEmail(email, fullName, tempPassword)` gọi sau khi liên kết.
5. Update: check trùng phone trừ chính member (`!member.phone.equals(new) && existsByPhone(new)`) → 400. Email không đổi.
6. `toggleStatus`: đổi `member.status` VÀ đồng thời `userAccount.status` (nếu != null) trong cùng transaction.
7. Audit log: `CREATE_MEMBER` / `UPDATE_MEMBER` / `DEACTIVATE_MEMBER` / `ACTIVATE_MEMBER` (entity="Member").
8. Parse an toàn: `gender` sai → 400 "Giới tính không hợp lệ"; `dob` sai định dạng → 400 "Ngày sinh không hợp lệ" (chỉ khi != null/blank).
9. `DataIntegrityViolationException` sau save được bắt để xử lý race condition trùng phone/email.
10. 404 "Không tìm thấy hội viên" cho update/toggle/detail khi id không tồn tại.
11. `getMemberDetail` trả `activePackages` và `bookingHistory` = `List.of()` (UC3.2/UC5.1 chưa có entity) — không throw.
12. Mọi service method write đều `@Transactional`; read dùng `@Transactional(readOnly = true)`.

### Issues / TODO
- `activePackages` / `bookingHistory` hiện luôn rỗng — cần nối khi UC3.2 (member_package) và UC5.1 (booking) có entity. Rule cảnh báo gói sắp hết (sessionsRemaining ≤ 2 / endDate ≤ today+7) sẽ implement ở đó.
- Chưa có unit/integration test cho MemberService/Controller.
- DELETE thực sự không có (spec dùng soft-delete qua PATCH status — đúng thiết kế).
- `createMember` gửi email trước khi transaction commit; NotificationService hiện là mock nên không ảnh hưởng, nhưng khi dùng email thật nên cân nhắc gửi sau commit (TransactionSynchronization) để tránh gửi khi rollback.
