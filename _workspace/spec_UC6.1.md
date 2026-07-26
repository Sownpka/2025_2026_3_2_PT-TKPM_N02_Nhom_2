# Spec UC6.1 — Quản lý tài chính

## Thông tin chung

- **UC ID:** UC6.1
- **Tên:** Quản lý tài chính
- **Actor:** ADMIN
- **Route:** `/admin/finance`
- **Màn hình tham chiếu:** Hình 79 (trang chính), Hình 80 (thêm khoản chi), Hình 81 (biểu đồ so sánh)
- **Dependency:** UC3.2 (package_transaction đã có dữ liệu thu)

---

## Luồng cơ bản (Hình 79)

1. Admin vào `/admin/finance`
2. Hệ thống hiển thị tháng hiện tại (mặc định) với:
   - Bộ chọn tháng (month picker)
   - 3 card: **Tổng thu | Tổng chi | Lợi nhuận**
   - Danh sách khoản chi trong tháng
   - Tab/nút "So sánh theo tháng" → Hình 81
3. **Tổng thu** = SUM(package_transaction.amount) WHERE month(created_at) = tháng chọn
4. **Tổng chi** = SUM(expense.amount) WHERE month(expense_date) = tháng chọn
5. **Lợi nhuận** = Tổng thu − Tổng chi (âm → hiển thị đỏ)

---

## Luồng phụ

### S-1 — Thêm khoản chi (Hình 80)

Form:
- **Loại chi phí(*)** — dropdown 4 giá trị **ĐÚNG NGUYÊN VĂN**:
  - "Lương huấn luyện viên" → enum `LUONG_HLV`
  - "Chi phí thiết bị" → enum `CHI_PHI_THIET_BI`
  - "Chi phí vận hành" → enum `CHI_PHI_VAN_HANH`
  - "Khác" → enum `KHAC`
- **Số tiền(*)** — nhập số, định dạng VNĐ
- **Ngày chi(*)** — date picker
- **Ghi chú** — text tự do

Lưu → cập nhật lại 3 card + danh sách.

### E-1 — Số tiền không hợp lệ

- Số tiền ≤ 0 hoặc không phải số → lỗi trường "Số tiền phải lớn hơn 0"
- Validate cả frontend lẫn backend

### S-2 — Sửa/Xóa khoản chi

- Mỗi hàng: nút **"Sửa"** (cam) + nút **"Xóa"** (đỏ)
- Xóa: dialog xác nhận → **hard delete** (khác soft delete của entity nghiệp vụ)
- Sửa: mở form S-1 prefill dữ liệu → Cập nhật
- Sau mỗi thao tác: re-fetch report để cập nhật 3 card

### S-3 — So sánh theo tháng (Hình 81)

- Tab "So sánh theo tháng" → biểu đồ cột nhóm (Recharts `BarChart`)
- 3 series: Thu (teal), Chi (đỏ), Lợi nhuận (xanh lá hoặc đỏ)
- 6 tháng gần nhất (từ tháng hiện tại trở về)
- Trục X: "T1/2026", "T2/2026"...
- Trục Y: số tiền VNĐ (format tắt: "5M", "10M" hoặc `Intl.NumberFormat`)

---

## API Endpoints

```
GET /api/finance/report?month=YYYY-MM
  - ADMIN only
  - Response: {
      month: string,              // "YYYY-MM"
      totalRevenue: number,       // Tổng thu (VNĐ)
      totalExpense: number,       // Tổng chi (VNĐ)
      profit: number,             // = totalRevenue - totalExpense
      transactions: Array<{       // danh sách giao dịch thu
        id: number,
        memberName: string,
        packageTypeName: string,
        amount: number,
        type: "NEW" | "RENEWAL",
        createdAt: string
      }>,
      expenses: Array<{           // danh sách khoản chi
        id: number,
        category: string,         // "LUONG_HLV"|"CHI_PHI_THIET_BI"|"CHI_PHI_VAN_HANH"|"KHAC"
        categoryLabel: string,    // "Lương huấn luyện viên" v.v.
        amount: number,
        expenseDate: string,      // "yyyy-MM-dd"
        note: string | null,
        createdAt: string
      }>
    }

POST /api/finance/expenses
  - ADMIN only
  - Body: { category: string, amount: number, expenseDate: string, note?: string }
  - 400 nếu amount <= 0 hoặc thiếu trường bắt buộc
  - Response: expense object vừa tạo

PUT /api/finance/expenses/{id}
  - ADMIN only
  - Body: giống POST
  - 404 nếu không tìm thấy
  - Response: expense object đã update

DELETE /api/finance/expenses/{id}
  - ADMIN only — hard delete
  - 404 nếu không tìm thấy
  - Response: 204 No Content

GET /api/finance/comparison?months=6
  - ADMIN only
  - Response: Array<{
      month: string,      // "YYYY-MM"
      monthLabel: string, // "T1/2026"
      revenue: number,
      expense: number,
      profit: number
    }> (6 phần tử, mới nhất cuối)
```

---

## Data model

```sql
-- Đã có từ CLAUDE.md:
expense(id, category ENUM(LUONG_HLV,CHI_PHI_THIET_BI,CHI_PHI_VAN_HANH,KHAC),
        amount DECIMAL(12,0), expense_date DATE, note TEXT,
        created_by BIGINT FK user_account.id, created_at DATETIME)

package_transaction(id, member_package_id FK, member_id FK,
                    amount DECIMAL(12,0), type ENUM(NEW,RENEWAL), created_at DATETIME)
```

Cả 2 bảng cần tạo JPA Entity. `Expense` là entity mới. `PackageTransaction` có thể đã có stub từ UC3.2 — kiểm tra.

---

## Giao diện (Hình 79–81)

### Trang chính `/admin/finance` (Hình 79)

```
[Tài chính]                          [Bộ chọn tháng: ◀ Tháng 7/2026 ▶]

  Tổng thu          Tổng chi         Lợi nhuận
 ┌──────────┐      ┌──────────┐     ┌──────────┐
 │ 45.000.000₫│    │ 12.000.000₫│   │ 33.000.000₫│
 │  (xanh lá) │    │  (đỏ)    │    │  (teal)  │
 └──────────┘      └──────────┘     └──────────┘

  [Tab: Khoản chi]  [Tab: So sánh theo tháng]

  [+ Thêm khoản chi]

  Bảng khoản chi:
  Loại | Số tiền | Ngày chi | Ghi chú | Thao tác
  ─────────────────────────────────────────────
  Lương HLV | 5.000.000₫ | 15/07/2026 | - | [Sửa][Xóa]
```

**Màu card:**
- Tổng thu: chữ xanh lá `text-green-600`
- Tổng chi: chữ đỏ `text-red-600`
- Lợi nhuận: chữ teal `text-teal-600` (âm → đỏ)

**Bộ chọn tháng:** 2 nút ◀ ▶ + label "Tháng M/YYYY"; không dùng date-picker phức tạp.

### Form thêm/sửa khoản chi (Hình 80)

Modal hoặc inline form:
- Dropdown Loại chi phí (4 options nguyên văn tiếng Việt)
- Input số tiền (placeholder "0 ₫")
- Date input ngày chi
- Textarea ghi chú
- Nút "Lưu" (teal) + "Hủy" (xám)

**E-1:** inline error dưới trường Số tiền: "Số tiền phải lớn hơn 0"

### Biểu đồ so sánh (Hình 81)

Tab "So sánh theo tháng":
```
         Thu  Chi  Lợi nhuận
T2/2026  ████ ██   ██████
T3/2026  ...
...
T7/2026  ████ ████ 
```

Recharts `BarChart` grouped, 3 `Bar` (fill teal/red/green).
Trục X: monthLabel. Trục Y: số tiền (tooltip VNĐ đầy đủ).
`ResponsiveContainer width="100%" height={350}`.

---

## Format tiền VNĐ

```typescript
const formatVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
// Output: "12.500.000 ₫"
```

---

## Notes cho Backend Dev

1. Kiểm tra `PackageTransaction` entity đã tồn tại từ UC3.2 (`com.picore.memberpackage` hoặc `com.picore.finance`). Nếu chưa → tạo mới.
2. `Expense` entity mới với enum `ExpenseCategory { LUONG_HLV, CHI_PHI_THIET_BI, CHI_PHI_VAN_HANH, KHAC }`.
3. `categoryLabel` trong response: map enum → tiếng Việt trong service (không lưu label vào DB).
4. `GET /finance/report`: 2 query — SUM transactions + load expenses theo tháng. Month filter: `YEAR(created_at)=Y AND MONTH(created_at)=M`.
5. `GET /finance/comparison`: vòng lặp 6 tháng gần nhất, mỗi tháng tính revenue+expense.
6. Validate `amount > 0` trong service (throw ApiException 400).
7. `created_by` = userId từ JWT (SecurityContext).
8. Hard delete `Expense` — dùng `deleteById` thẳng, không soft delete.
9. `monthLabel`: format "T{M}/{YYYY}" (ví dụ "T7/2026").

## Notes cho Frontend Dev

1. Route `/admin/finance` — kiểm tra App.tsx đã có Placeholder chưa
2. Sidebar ADMIN đã có "Tài chính" → `/admin/finance` (kiểm tra)
3. Layout title: "Tài chính"
4. Recharts đã có trong dependencies — import trực tiếp
5. 2 tab state: `'expenses' | 'comparison'`
6. Khi đổi tháng hoặc add/edit/delete expense → re-fetch `report`
7. Tab comparison: fetch `comparison` 1 lần khi chuyển sang tab đó
8. `formatVND` dùng `Intl.NumberFormat('vi-VN')`

## Notes cho QA

- Verify tổng thu tự động từ package_transaction (không nhập tay)
- Verify lợi nhuận âm → chữ đỏ
- Verify E-1: amount ≤ 0 → lỗi cả FE và BE
- Verify hard delete (không soft delete)
- Verify comparison trả đúng 6 tháng, mới nhất cuối
- Verify formatVND đúng "12.500.000 ₫"
- Verify tab comparison render BarChart với 3 Bar
