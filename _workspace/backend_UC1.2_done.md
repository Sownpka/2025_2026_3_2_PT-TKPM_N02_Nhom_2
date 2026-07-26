## Backend done: UC1.2

### Files created/modified

**Created — `com.picore.common.audit`**
- `AuditLog.java` — JPA entity, bảng `audit_log` (id IDENTITY, actorId, action(50), entity(50), entityId nullable, detail TEXT nullable, createdAt @PrePersist). NO Lombok.
- `AuditLogRepository.java` — extends `JpaRepository<AuditLog, Long>`.
- `AuditLogService.java` — `@Service`, method `@Transactional void log(actorId, action, entity, entityId, detail)`.

**Created — `com.picore.auth`**
- `AccountService.java` — `@Service`, business logic + audit.
- `AccountController.java` — `@RestController @RequestMapping("/accounts") @PreAuthorize("hasRole('ADMIN')")`.

**Created — `com.picore.auth.dto`**
- `AccountResponse.java` (record) — id, fullName, email, phone, role, status, createdAt (String ISO).
- `CreateAccountRequest.java` (record) — @NotBlank fullName, @NotBlank @Email email, phone, @NotNull role, @NotBlank password, @NotBlank confirmPassword.
- `UpdateAccountRequest.java` (record) — @NotBlank fullName, phone, @NotNull role.

**Modified**
- `UserAccountRepository.java` — thêm `existsByEmail(String)` và `findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(name, email)`.

### API endpoints (ADMIN only)
```
GET   /accounts?search=          → 200 List<AccountResponse>
POST  /accounts                  → 201 AccountResponse
PUT   /accounts/{id}             → 200 AccountResponse
PATCH /accounts/{id}/status      → 200 AccountResponse   (toggle ACTIVE↔INACTIVE)
```
`actorId` lấy từ `((UserPrincipal) auth.getPrincipal()).id()` qua param `Authentication auth`.

### Request/Response shapes
- **AccountResponse**: `{ id, fullName, email, phone, role, status, createdAt }` (role/status là String enum name, createdAt = `LocalDateTime.toString()` ISO).
- **CreateAccountRequest**: `{ fullName, email, phone, role, password, confirmPassword }`.
- **UpdateAccountRequest**: `{ fullName, phone, role }` (email không sửa được).
- Lỗi trả về theo `ErrorResponse` hiện có: field-level `{field, message}` cho lỗi field, message chung cho lỗi khác (qua `GlobalExceptionHandler`).

### Business rules enforced
1. `confirmPassword` khác `password` → 400 field=confirmPassword "Mật khẩu nhập lại không khớp".
2. `password.length() < 8` → 400 field=password "Mật khẩu phải có ít nhất 8 ký tự".
3. Role không parse được `UserAccount.Role` → 400 field=role "Vai trò không hợp lệ".
4. `existsByEmail` → 400 field=email "Email đã tồn tại"; đồng thời bắt `DataIntegrityViolationException` (dùng `saveAndFlush`) để chống race condition, trả cùng thông báo.
5. Update/toggle không tìm thấy id → 404 "Không tìm thấy tài khoản".
6. Soft delete: toggleStatus chỉ đổi `status` (ACTIVE↔INACTIVE), không xóa record.
7. Audit log cho: CREATE_ACCOUNT, UPDATE_ACCOUNT, DEACTIVATE_ACCOUNT / ACTIVATE_ACCOUNT (actorId từ JWT).
8. Phân quyền class-level `@PreAuthorize("hasRole('ADMIN')")` (đã bật `@EnableMethodSecurity`).
9. Tìm kiếm: search blank → findAll; có search → LIKE fullName/email case-insensitive.

### Extra
- Thêm `createMemberAccount(email, fullName)` trong AccountService để UC2.1 dùng lại (role=MEMBER, mustChangePassword=true, mật khẩu tạm "changeme123"). Không nằm trong danh sách bắt buộc nhưng spec mục "Mối liên hệ với UC khác" yêu cầu.

### Issues / TODO
- `mvn compile` PASS (exit 0).
- Chưa viết unit/integration test (không có trong scope task).
- `createMemberAccount` dùng mật khẩu mặc định tạm — UC2.1 nên gửi email đặt lại mật khẩu / buộc đổi khi đăng nhập lần đầu.
- Không có migration file riêng (project dựa vào JPA ddl-auto để tạo bảng `audit_log`); nếu dùng Flyway/Liquibase sau này cần thêm migration.
