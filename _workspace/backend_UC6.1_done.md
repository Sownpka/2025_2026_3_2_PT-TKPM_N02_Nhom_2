# Backend UC6.1 — Quản lý tài chính (ĐÃ XONG)

Compile: `mvn clean compile` → **BUILD SUCCESS** (exit 0).

## Files

### Tạo mới
- `finance/Expense.java` — entity + enum `ExpenseCategory{LUONG_HLV, CHI_PHI_THIET_BI, CHI_PHI_VAN_HANH, KHAC}` với `toLabel()`.
- `finance/ExpenseRepository.java` — `findByExpenseDateBetweenOrderByExpenseDateDesc`, `sumAmountByExpenseDateBetween`.
- `finance/dto/FinanceReportResponse.java` — record lồng `TransactionItem`, `ExpenseItem`.
- `finance/dto/CreateExpenseRequest.java`, `finance/dto/ExpenseResponse.java`, `finance/dto/MonthComparisonItem.java`.
- `finance/FinanceService.java` — `@Service @Transactional(readOnly=true)`.
- `finance/FinanceController.java` — `@RequestMapping("/finance")`, `@PreAuthorize("hasRole('ADMIN')")`.

### Sửa (không phá vỡ code cũ)
- `memberpackage/PackageTransactionRepository.java` — thêm 2 query cho UC6.1
  (`findWithDetailsByCreatedAtBetween` fetch-join, `sumAmountByCreatedAtBetween`). Giữ nguyên method cũ.

### Dùng lại, KHÔNG sửa
- `memberpackage/PackageTransaction.java` — **đã tồn tại từ UC3.2**, không đụng vào.

## Quyết định kỹ thuật quan trọng

1. **`PackageTransaction` khác spec giả định.** Entity thật (từ UC3.2):
   - `amount` là `Long` (không phải BigDecimal).
   - `member` và `memberPackage` là quan hệ `@ManyToOne` (không phải Long field).
   - Vì vậy KHÔNG dùng cách batch-load qua memberRepository/memberPackageRepository như task mô tả.
     Thay vào đó dùng **1 query fetch-join** (`JOIN FETCH member`, `memberPackage`, `packageType`)
     → tránh N+1, service chỉ cần inject 2 repo (transaction + expense).

2. **Kiểu tiền tệ.** Toàn bộ tiền trong DB dự án là `DECIMAL(_,0)` map sang `Long`
   (PackageTransaction.amount, PackageType.price). `Expense.amount` để `BigDecimal(precision=14, scale=0)`
   đúng theo task. Trong service, revenue sum (Long) được convert `BigDecimal.valueOf(...)`;
   DTO/report toàn bộ dùng `BigDecimal` → JSON trả number. Frontend nhận number bình thường.

3. **Context-path = `/api`** (application.yml). Controller map `/finance` → URL thật là
   `/api/finance/report`, `/api/finance/expenses`, `/api/finance/comparison`. (Spec ghi `/api/finance`
   nhưng nếu để `@RequestMapping("/api/finance")` sẽ thành `/api/api/finance` — đã tránh.)

4. **UserPrincipal** ở package `com.picore.common.security` (không phải `com.picore.auth`).
   Lấy userId qua `principal.id()`. `@AuthenticationPrincipal UserPrincipal principal`.

5. **Lỗi** dùng `ApiException(HttpStatus, message)` hoặc `ApiException(HttpStatus, field, message)`
   — đã có `GlobalExceptionHandler` map sang `ErrorResponse`. Validate amount ≤ 0 → 400 field `amount`
   message "Số tiền phải lớn hơn 0". Category/date sai → 400. Update/Delete not found → 404.

6. **Xóa cứng**: `deleteById` sau khi check `existsById` (404 nếu không có). Không soft delete.

7. **comparison**: mặc định 6 tháng, trả **cũ → mới** (mới nhất cuối). `monthLabel = "T{M}/{YYYY}"`,
   `month = "YYYY-MM"` (YearMonth.toString()).

8. `createdAt` trả string qua `LocalDateTime.toString()` (ISO, vd `2026-07-19T14:30:00`);
   `expenseDate` qua `LocalDate.toString()` (`yyyy-MM-dd`).

## API (thực tế, đã tính context-path)

| Method | URL | Body/Param | Response |
|---|---|---|---|
| GET | `/api/finance/report?month=YYYY-MM` | month optional (mặc định tháng hiện tại) | FinanceReportResponse |
| POST | `/api/finance/expenses` | `{category, amount, expenseDate, note?}` | 201 ExpenseResponse |
| PUT | `/api/finance/expenses/{id}` | giống POST | 200 ExpenseResponse (404 nếu ko có) |
| DELETE | `/api/finance/expenses/{id}` | — | 204 No Content (404 nếu ko có) |
| GET | `/api/finance/comparison?months=6` | months optional | List<MonthComparisonItem> |

## Lưu ý cho Frontend

- `category` gửi lên là **enum name** (`LUONG_HLV`, `CHI_PHI_THIET_BI`, `CHI_PHI_VAN_HANH`, `KHAC`),
  KHÔNG phải label tiếng Việt. Response có cả `category` (enum) và `categoryLabel` (tiếng Việt) để hiển thị.
- `amount` gửi lên là number thuần (VNĐ, không format). Backend validate > 0, trả 400 field `amount`
  message "Số tiền phải lớn hơn 0" (lỗi dạng object `{field, message}` từ GlobalExceptionHandler).
- `expenseDate` format `yyyy-MM-dd`.
- `type` trong transaction là `"NEW"` | `"RENEWAL"`.
- comparison: mảng 6 phần tử, **phần tử cuối là tháng hiện tại** — vẽ trục X theo thứ tự trả về.
- Tổng thu tự động từ package_transaction, không nhập tay.

## Lưu ý DB
- Bảng `expense` mới — ddl-auto (Hibernate) sẽ tạo nếu môi trường dev dùng update/create.
  Cột: id, category (varchar/enum-string), amount DECIMAL(14,0), expense_date DATE, note TEXT,
  created_by BIGINT, created_at DATETIME.
- Bảng `package_transaction` đã có từ UC3.2.
