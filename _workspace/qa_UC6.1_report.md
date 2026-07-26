# QA Report — UC6.1 Quản lý tài chính

## Kết quả: PASS

Kiểm tra tích hợp toàn bộ backend ↔ frontend UC6.1. Không phát hiện lỗi chặn (blocking). Chỉ có 2 ghi chú nhỏ (WARNING, không ảnh hưởng chức năng).

---

## API Shape: OK

**FinanceReportResponse** (record BE → interface FE khớp hoàn toàn):
- `month` String / `totalRevenue`, `totalExpense`, `profit` BigDecimal → JSON number → FE `number`. OK.
- `transactions[]`: id, memberName, packageTypeName, amount, type, createdAt — khớp `TransactionItem` FE. OK.
- `expenses[]`: id, category, categoryLabel, amount, expenseDate, note(nullable), createdAt — khớp `ExpenseItem` FE (`note: string | null`). OK.

**ExpenseResponse** (BE record): id, category, categoryLabel, amount, expenseDate, note, createdAt. FE `type ExpenseResponse = ExpenseItem` khớp. OK.

**MonthComparisonItem**: month, monthLabel, revenue, expense, profit — khớp cả hai phía. OK.

**CreateExpenseRequest (FE→BE)**: `category` string enum-name, `amount` number (BE nhận BigDecimal), `expenseDate` "yyyy-MM-dd", `note?` optional (FE gửi `undefined` khi rỗng). OK.

## Endpoints: OK

Context-path `/api` + axios baseURL `/api` xử lý đúng (controller map `/finance`, endpoints.ts dùng `/finance/...`):
- `GET /api/finance/report?month=` — `FINANCE.REPORT` + `params:{month}`. OK.
- `POST /api/finance/expenses` — `FINANCE.EXPENSES`. OK.
- `PUT /api/finance/expenses/{id}` — `FINANCE.EXPENSE_BY_ID(id)`. OK.
- `DELETE /api/finance/expenses/{id}` — `FINANCE.EXPENSE_BY_ID(id)`. OK.
- `GET /api/finance/comparison?months=6` — `FINANCE.COMPARISON` + `params:{months}`. OK.

## Business Rules: OK

- **BR-1 (Tổng thu tự động)**: OK. `FinanceService.revenueBetween()` gọi `transactionRepository.sumAmountByCreatedAtBetween()` (JPQL `SUM(t.amount)`). Không có hardcode, không có UI nhập tay ở FE.
- **BR-2 (Lợi nhuận)**: OK. `profit = totalRevenue.subtract(totalExpense)` (FinanceService.java:52) — đúng chiều thu − chi. Comparison cũng `revenue.subtract(expense)` (dòng 113).
- **BR-3 (Validate amount > 0)**: OK cả hai phía.
  - BE: `validateAmount()` throw `ApiException(400, "amount", "Số tiền phải lớn hơn 0")` (dòng 163-168).
  - FE: `validate()` chặn `isNaN(amt) || amt <= 0` → inline "Số tiền phải lớn hơn 0" (ExpenseFormModal.tsx:56).
- **BR-4 (Hard delete)**: OK. `deleteExpense()` dùng `expenseRepository.deleteById(id)` sau `existsById` check (404). Không set status, không soft delete.
- **BR-5 (Comparison 6 tháng cũ→mới)**: OK. Vòng lặp `for (i = span-1; i >= 0; i--)` với `current.minusMonths(i)` → phần tử đầu cũ nhất, cuối là tháng hiện tại. FE vẽ theo thứ tự BE trả về (không sort lại).
- **BR-6 (monthLabel "T{M}/{YYYY}")**: OK. `"T" + ym.getMonthValue() + "/" + ym.getYear()` → "T7/2026" (dòng 114).

## Security: OK

- `FinanceController`: `@PreAuthorize("hasRole('ADMIN')")` class-level (dòng 31). OK.
- FE route `/admin/finance` nằm trong `<ProtectedRoute allowedRoles={['ADMIN']}>` (App.tsx:49, 68). OK.

## Routing: OK

- App.tsx dòng 68 render `<FinancePage />` (không phải Placeholder). Import dòng 13. OK.
- Sidebar ADMIN có `{ label: 'Tài chính', path: '/admin/finance' }` (Sidebar.tsx:21). OK.
- Layout `PAGE_TITLES['/admin/finance'] = 'Tài chính'` (Layout.tsx:14). OK.

## UX/Labels: OK

- 3 card: Tổng thu `text-green-600` (xanh lá), Tổng chi `text-red-600` (đỏ), Lợi nhuận `text-teal-600` và `profit < 0 → text-red-600` (FinancePage.tsx:177-195). OK.
- `formatVND` = `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })` → "12.500.000 ₫". OK.
- Dropdown 4 options đúng nguyên văn: "Lương huấn luyện viên", "Chi phí thiết bị", "Chi phí vận hành", "Khác" (ExpenseFormModal.tsx:118-121). OK.
- Bảng cột "Loại" dùng `expense.categoryLabel` (FinancePage.tsx:256), không phải enum. OK.
- Recharts BarChart 3 Bar: `dataKey="revenue"|"expense"|"profit"` khớp fields của MonthComparisonItem (dòng 302-304). XAxis `dataKey="monthLabel"`, YAxis format "5M", Tooltip `formatVND`, ResponsiveContainer height 350. OK.
- Hard delete có dialog xác nhận ("Bạn có chắc muốn xóa khoản chi này?") trước khi gọi `deleteExpense`. OK.
- Empty state: "Chưa có khoản chi nào trong tháng này" (dòng 284). OK.

## categoryLabel mapping: OK

`Expense.ExpenseCategory.toLabel()` khớp đúng dropdown FE:
- LUONG_HLV → "Lương huấn luyện viên" ✓
- CHI_PHI_THIET_BI → "Chi phí thiết bị" ✓
- CHI_PHI_VAN_HANH → "Chi phí vận hành" ✓
- KHAC → "Khác" ✓

## Category enum gửi đúng: OK

ExpenseFormModal `<option value="LUONG_HLV">` v.v. — `category` state = value của option = enum name. `handleSubmit` gửi `category` nguyên state string vào `CreateExpenseRequest`. BE `parseCategory` dùng `ExpenseCategory.valueOf(category)`. Khớp. OK.

---

## Issues

- `FinancePage.tsx:152` — WARNING — Tiêu đề trong trang là `<h1>Báo cáo tài chính</h1>` trong khi Header (từ Layout) hiển thị "Tài chính". Hai tiêu đề hơi trùng lặp/không đồng nhất về câu chữ. Không ảnh hưởng chức năng, chỉ là cosmetic.
- `ExpenseFormModal.tsx:21` — WARNING — `todayISO()` dùng `new Date().toISOString()` (giờ UTC). Ở múi giờ VN (UTC+7), trong khoảng 00:00–07:00 giờ local ngày mặc định của khoản chi mới có thể lệch về hôm trước. Chỉ ảnh hưởng giá trị mặc định (admin vẫn sửa được), không chặn luồng.

---

## Kết luận

UC6.1 (Quản lý tài chính) tích hợp backend ↔ frontend **PASS**. API shape, endpoints, 6 business rule (BR-1..BR-6), security ADMIN-only, routing/navigation, nhãn tiếng Việt, categoryLabel mapping và category enum gửi lên đều khớp spec. Doanh thu lấy tự động từ `package_transaction` qua repository query (không nhập tay, không hardcode); lợi nhuận đúng chiều thu−chi và đổi màu đỏ khi âm; xóa là hard delete có dialog xác nhận; comparison trả 6 tháng cũ→mới với label "T{M}/{YYYY}". Chỉ còn 2 điểm cosmetic/edge-case mức WARNING, không cần chỉnh trước khi nghiệm thu. UC cuối của dự án hoàn tất.
