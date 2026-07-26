## Backend done: UC3.2

### Files created/modified

**Tạo mới (module `com.picore.memberpackage`):**
- `D:\Pi-core\backend\src\main\java\com\picore\memberpackage\MemberPackage.java` — JPA entity + enum `MemberPackageStatus { ACTIVE, EXPIRED, USED_UP }`
- `D:\Pi-core\backend\src\main\java\com\picore\memberpackage\PackageTransaction.java` — JPA entity + enum `TransactionType { NEW, RENEWAL }`
- `D:\Pi-core\backend\src\main\java\com\picore\memberpackage\MemberPackageRepository.java`
- `D:\Pi-core\backend\src\main\java\com\picore\memberpackage\PackageTransactionRepository.java`
- `D:\Pi-core\backend\src\main\java\com\picore\memberpackage\dto\RegisterPackageRequest.java` (record)
- `D:\Pi-core\backend\src\main\java\com\picore\memberpackage\dto\MemberPackageResponse.java` (record)
- `D:\Pi-core\backend\src\main\java\com\picore\memberpackage\MemberPackageService.java`
- `D:\Pi-core\backend\src\main\java\com\picore\memberpackage\MemberPackageController.java`
- `D:\Pi-core\backend\src\main\resources\db\migration\V1__create_member_package_tables.sql`

**Sửa (module `com.picore.member`):**
- `MemberRepository.java` — thêm query `searchByStatus(status, q)` (tìm theo tên hoặc SĐT)
- `MemberService.java` — thêm `searchActiveMembers(q)`
- `MemberController.java` — thêm endpoint `GET /members/search`

### API endpoints
- `POST /api/member-packages` (RECEPTIONIST) — Đăng ký/gia hạn gói. Tự xác định NEW vs RENEWAL, tính start/end date, số buổi; lưu `member_package` + BẮT BUỘC ghi `package_transaction` (snapshot giá) + ghi `audit_log`. Trả 201 + `MemberPackageResponse`.
- `GET /api/members/{id}/packages` (RECEPTIONIST) — Danh sách tất cả gói của hội viên (mới nhất trước), kèm `warningSessions`/`warningExpiry`.
- `GET /api/members/search?q=` (RECEPTIONIST) — Tìm hội viên ACTIVE theo tên hoặc SĐT (chỉ trả status ACTIVE). Trả `[]` khi `q` rỗng.

### Request/Response shapes
```java
record RegisterPackageRequest(
    @NotNull Long memberId,
    @NotNull Long packageTypeId,
    LocalDate startDate            // optional; null => today (chỉ dùng cho gói NEW)
)

@JsonInclude(NON_NULL)
record MemberPackageResponse(
    Long id, Long memberId, String memberName,
    String packageTypeName, String packageCategory,
    String startDate, String endDate,
    Integer sessionsRemaining, String status,
    String type,                  // NEW/RENEWAL (chỉ có ở POST; null ở GET list -> ẩn)
    Long amountPaid,              // chỉ có ở POST; null ở GET list -> ẩn
    boolean isPrivatePackage,     // true nếu GOI_1_1 / GOI_1_2
    boolean warningSessions,      // sessionsRemaining != null && <= 2
    boolean warningExpiry         // endDate < today + 8 ngày (<= 7 ngày)
)
```

### Business rules enforced
- `package_transaction` ghi bắt buộc mỗi lần đăng ký/gia hạn; `amount` = SNAPSHOT `packageType.price` tại thời điểm mua (không dùng giá hiện tại). Nguồn doanh thu UC6.1.
- `type` = NEW nếu hội viên chưa có gói ACTIVE, RENEWAL nếu đã có.
- Gia hạn: `start_date = end_date gói ACTIVE hiện tại (end_date muộn nhất) + 1 ngày`, không theo ngày giao dịch.
- NEW: `start_date = request.startDate` (hoặc `today` nếu null). `end_date = start_date + packageType.durationDays`.
- `sessions_remaining` = `packageType.sessions` với THEO_BUOI/GOI_1_1/GOI_1_2; = `NULL` với THEO_THANG/KHONG_GIOI_HAN.
- `audit_log`: action="SELL_PACKAGE", entity="member_package", entity_id=<id mới>, detail = tên gói + tên hội viên + số tiền.
- `isPrivatePackage` = true với GOI_1_1/GOI_1_2 (để frontend hiển thị thông báo S-3).
- Cảnh báo R3.4: `warningSessions` (≤ 2 buổi), `warningExpiry` (≤ 7 ngày hết hạn).
- Validate member tồn tại + ACTIVE ("Không tìm thấy hội viên"); packageType tồn tại + ACTIVE ("Loại gói tập không tồn tại hoặc ngừng áp dụng") — thông báo tiếng Việt đúng nguyên văn spec, field khớp (`memberId`/`packageTypeId`).
- `@Transactional` ở service layer; `@PreAuthorize("hasRole('RECEPTIONIST')")` ở controller.
- Không dùng Lombok; DTO là Java record, entity là class thường.
- Không soft-delete cho `package_transaction` (đúng, đây là bản ghi giao dịch bất biến).

### Issues / TODO
- **Flyway chưa được cấu hình trong dự án.** `pom.xml` không có dependency `flyway`, schema đang do Hibernate quản lý (`ddl-auto: create-drop` ở dev tự sinh bảng từ entity; `validate` ở prod). File `V1__create_member_package_tables.sql` đã tạo đúng data model (mục 7 CLAUDE.md) và khớp entity, SẴN SÀNG khi nhóm bật Flyway; hiện tại nó là tài liệu schema chứ chưa tự chạy. Đây là migration SQL đầu tiên của dự án (chưa có bản nào trước) nên đặt version `V1`.
- `RegisterPackageRequest.startDate` kiểu `LocalDate` (theo yêu cầu task). Nếu client gửi chuỗi ngày sai định dạng, lỗi sẽ do Jackson bắt (HttpMessageNotReadable) chứ chưa map sang thông báo "Ngày bắt đầu không hợp lệ". Nếu cần đúng nguyên văn thông báo đó, đổi field sang `String` và parse thủ công như `MemberService.parseDob`.
- Chưa có seed data cho `member_package`/`package_transaction`; UC6.1 sẽ cần dữ liệu 6 tháng gần nhất (mục 9 CLAUDE.md) — để sau khi làm UC6.1.
- Chưa cập nhật `MemberService.getMemberDetail` (UC2.1 S-3) để đọc gói thật từ `member_package` — hiện vẫn trả list rỗng. Có thể nối sau nếu cần hiển thị gói trong modal chi tiết hội viên.
- Build: `mvn -o compile` BUILD SUCCESS (Java 17 target, Maven 3.9.16).
