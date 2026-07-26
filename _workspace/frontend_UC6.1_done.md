# Frontend UC6.1 — Quản lý tài chính (ĐÃ XONG)

Typecheck: `npx tsc --noEmit` → sạch (exit 0).

## Files

### Tạo mới
- `src/api/finance.ts` — types (TransactionItem, ExpenseItem, FinanceReportResponse, MonthComparisonItem, CreateExpenseRequest, ExpenseResponse) + 5 hàm gọi API (fetchFinanceReport, fetchComparison, createExpense, updateExpense, deleteExpense). Dùng lại `FINANCE` keys có sẵn trong `endpoints.ts`.
- `src/pages/admin/FinancePage.tsx` — trang chính: bộ chọn tháng ◀▶, 3 card (thu/chi/lợi nhuận), 2 tab (Khoản chi / So sánh theo tháng), bảng khoản chi, BarChart Recharts, dialog xác nhận xóa inline, toast.
- `src/pages/admin/ExpenseFormModal.tsx` — modal thêm/sửa khoản chi, prefill khi edit, validate FE, map lỗi field từ BE.

### Sửa
- `src/App.tsx` — import `FinancePage`, thay Placeholder `/admin/finance` bằng `<FinancePage />`.

### Kiểm tra (đã có sẵn, KHÔNG cần sửa)
- `src/api/endpoints.ts` — `FINANCE` keys đã có (REPORT, EXPENSES, EXPENSE_BY_ID, COMPARISON).
- `src/components/Sidebar.tsx` — ADMIN menu "Tài chính" → `/admin/finance` đã có (dòng 21).
- `src/components/Layout.tsx` — title `'/admin/finance': 'Tài chính'` đã có (dòng 14).

## Quyết định kỹ thuật
1. Client dùng `client.get(FINANCE.REPORT, { params: { month } })` — axios instance baseURL=`/api` đã có sẵn, nên path là `/finance/...` (khớp context-path `/api` của BE).
2. `parseApiError` (từ `api/auth.ts`) chuẩn hóa lỗi BE về `ApiError[]` (có `field`, `message`). Modal map field `amount`/`category`/`expenseDate` vào inline error; lỗi khác → general error.
3. Tooltip Recharts: dùng `formatter={(value) => formatVND(Number(value))}` (kiểu ValueType strict trong recharts version này, không nhận `(value: number)`).
4. `ExpenseResponse` khai báo là `type ExpenseResponse = ExpenseItem` (interface extends rỗng bị lint cảnh báo).
5. Validate FE: category rỗng, `parseFloat(amount) <= 0 || NaN`, expenseDate rỗng. BE cũng validate `amount > 0` (double-check E-1).
6. Race prevention: mọi useEffect dùng `active`-flag + cleanup.
7. Comparison fetch 1 lần khi vào tab (guard `if (tab !== 'comparison' || comparison) return`).
8. Sau add/edit/delete → `reloadReport()` fetch lại report để cập nhật 3 card + bảng.

## Lưu ý QA
- Tổng thu tự động từ package_transaction — không có UI nhập tay (đúng spec).
- Lợi nhuận âm → chữ đỏ (`profit >= 0 ? teal : red`).
- E-1: nhập amount ≤ 0 → inline "Số tiền phải lớn hơn 0" (chặn ở FE trước khi gọi BE; BE cũng trả 400 field amount nếu lọt qua).
- Xóa: dialog xác nhận → `deleteExpense` (hard delete, BE trả 204).
- Dropdown Loại chi phí: 4 option đúng nguyên văn, value = enum name.
- Cột "Loại" trong bảng hiển thị `categoryLabel` (tiếng Việt), không phải enum.
- BarChart: 3 series Doanh thu (teal #0D9488) / Chi phí (đỏ #EF4444) / Lợi nhuận (xanh #22C55E); trục X = monthLabel ("T7/2026"), trục Y format "5M".
- Comparison trả 6 phần tử, mới nhất cuối — vẽ theo thứ tự BE trả về (không sort lại).
- formatVND: `Intl.NumberFormat('vi-VN', currency VND)` → "12.500.000 ₫".
- Ngày chi hiển thị dd/MM/yyyy; date input mặc định hôm nay khi thêm mới.
- Đổi tháng bằng ◀▶ (thao tác string "YYYY-MM" qua Date, xử lý đúng bước qua năm).
