# Spec: UC3.1 — Cấu hình loại gói tập

## Thông tin chung
- **Route:** `/admin/package-types`
- **Vai trò:** ADMIN (quản lý); GET cũng cho RECEPTIONIST (dùng trong UC3.2 dropdown)
- **Giao diện:** Hình 34–39

---

## Luồng cơ bản

Hiển thị bảng danh sách loại gói (Hình 34):
- Cột: **Tên gói | Phân loại | Số buổi | Thời hạn (ngày) | Giá | Trạng thái | Thao tác**
- Thao tác: **"Sửa"** (cam `#F59E0B`), **"Ngừng áp dụng"** (đỏ `#EF4444`)
- Nút **"+ Thêm loại gói"** (teal)
- Cột Số buổi: hiển thị số nếu có, "—" nếu null (gói theo tháng/không giới hạn)
- Cột Giá: format VNĐ `Intl.NumberFormat('vi-VN')` → `12.500.000 ₫`
- Pill trạng thái: "Đang áp dụng" (xanh lá) / "Ngừng áp dụng" (xám)

---

## Phân loại gói (enum `PackageCategory`)

| Enum value | Hiển thị | Số buổi |
|-----------|----------|---------|
| `THEO_BUOI` | Theo buổi | **Bắt buộc** (> 0) |
| `THEO_THANG` | Theo tháng | null (không áp dụng) |
| `KHONG_GIOI_HAN` | Không giới hạn | null |
| `GOI_1_1` | Gói 1-1 | **Bắt buộc** (> 0) |
| `GOI_1_2` | Gói 1-2 | **Bắt buộc** (> 0) |

---

## Luồng phụ

### S-1 Thêm loại gói (Hình 35)
Form: **Tên gói(\*)**, **Phân loại(\*)** (dropdown 5 lựa chọn), **Số buổi** (conditional), **Thời hạn ngày(\*)**, **Giá(\*)**, Mô tả (textarea). Nút **"Lưu"**.

Validate:
- Tên gói unique → **"Tên gói tập đã tồn tại"** (Hình 36)
- Thiếu Số buổi khi chọn THEO_BUOI / GOI_1_1 / GOI_1_2 → lỗi field=sessions **"Số buổi là bắt buộc với loại gói này"** (Hình 37)
- Số buổi ≤ 0 → **"Số buổi phải lớn hơn 0"**
- Giá ≤ 0 → **"Giá phải lớn hơn 0"**
- Thời hạn ≤ 0 → **"Thời hạn phải lớn hơn 0"**
- Thiếu trường bắt buộc → highlight đỏ

### S-2 Sửa (Hình 38)
Form prefill, validate như S-1. Nút **"Cập nhật"**. Toast thành công.

### S-3 Ngừng áp dụng (Hình 39)
Confirm dialog: **"Bạn có chắc muốn ngừng áp dụng loại gói này? Các gói hội viên đã mua vẫn được giữ nguyên."**
→ Xác nhận → set `status = INACTIVE` (soft delete). Pill đổi thành "Ngừng áp dụng".
**Không xóa record** — member_package cũ vẫn hợp lệ.

---

## API endpoints

```
GET   /package-types              → 200 PackageTypeResponse[]    (ADMIN + RECEPTIONIST)
GET   /package-types/active       → 200 PackageTypeResponse[]    (ADMIN + RECEPTIONIST, chỉ ACTIVE — dùng cho dropdown UC3.2)
POST  /package-types              → 201 PackageTypeResponse      (ADMIN)
PUT   /package-types/{id}         → 200 PackageTypeResponse      (ADMIN)
PATCH /package-types/{id}/status  → 200 PackageTypeResponse      (ADMIN, toggle)
```

### PackageTypeResponse (record)
```
Long id
String name
String category        ("THEO_BUOI"|"THEO_THANG"|"KHONG_GIOI_HAN"|"GOI_1_1"|"GOI_1_2")
Integer sessions       (nullable)
Integer durationDays
Long price
String description     (nullable)
String status          ("ACTIVE"|"INACTIVE")
```

### CreatePackageTypeRequest (record)
```
@NotBlank String name
@NotNull String category
Integer sessions       (nullable — backend validate bắt buộc nếu category cần sessions)
@NotNull @Positive Integer durationDays
@NotNull @Positive Long price
String description
```

### UpdatePackageTypeRequest (record)
```
@NotBlank String name
@NotNull String category
Integer sessions
@NotNull @Positive Integer durationDays
@NotNull @Positive Long price
String description
```

---

## Data model

### PackageType entity (bảng `package_type`) — mới
```sql
package_type(
  id BIGINT PK AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  category ENUM('THEO_BUOI','THEO_THANG','KHONG_GIOI_HAN','GOI_1_1','GOI_1_2') NOT NULL,
  sessions INT NULL,
  duration_days INT NOT NULL,
  price DECIMAL(12,0) NOT NULL,
  description TEXT NULL,
  status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE'
)
```

> Không cần `created_at` — spec không yêu cầu hiển thị.

---

## Business rules

1. **Tên gói unique** — check `existsByName` + bắt `DataIntegrityViolationException` → 400 field=name **"Tên gói tập đã tồn tại"**
2. **Sessions bắt buộc với THEO_BUOI / GOI_1_1 / GOI_1_2** — validate ở service: nếu category là 1 trong 3 này mà sessions null hoặc ≤ 0 → 400 field=sessions **"Số buổi là bắt buộc với loại gói này"**
3. **Sessions phải null với THEO_THANG / KHONG_GIOI_HAN** — service tự set null (không validate lỗi, chỉ ignore giá trị nếu có)
4. **Giá > 0**, **Thời hạn > 0** — @Positive constraint trên DTO (lỗi validation tự động từ GlobalExceptionHandler)
5. **Soft delete** — PATCH /status toggle ACTIVE↔INACTIVE
6. **Audit log**: CREATE_PACKAGE_TYPE, UPDATE_PACKAGE_TYPE, DEACTIVATE_PACKAGE_TYPE

---

## Files backend cần tạo

```
backend/src/main/java/com/picore/packageplan/
├── PackageType.java              (JPA entity — NO Lombok)
├── PackageTypeRepository.java
├── PackageTypeController.java
├── PackageTypeService.java
└── dto/
    ├── PackageTypeResponse.java        (record)
    ├── CreatePackageTypeRequest.java   (record)
    └── UpdatePackageTypeRequest.java   (record)
```

> Package name: `com.picore.packageplan` (theo folder layout trong CLAUDE.md: `packageplan/`)

---

## Files frontend cần tạo

```
frontend/src/
├── api/packageTypes.ts
└── pages/admin/AdminPackageTypesPage.tsx
```

Cập nhật:
- `src/types/index.ts` — thêm `PackageTypeResponse`
- `src/App.tsx` — `/admin/package-types` → `<AdminPackageTypesPage />`
- `src/components/Layout.tsx` — thêm `/admin/package-types` vào PAGE_TITLES map

---

## Lưu ý quan trọng cho frontend

### Hiển thị phân loại
```typescript
const CATEGORY_LABEL: Record<string, string> = {
  THEO_BUOI:     'Theo buổi',
  THEO_THANG:    'Theo tháng',
  KHONG_GIOI_HAN:'Không giới hạn',
  GOI_1_1:       'Gói 1-1',
  GOI_1_2:       'Gói 1-2',
}
```

### Conditional field Số buổi
- Khi phân loại = THEO_BUOI / GOI_1_1 / GOI_1_2 → hiện field Số buổi (required)
- Khi phân loại = THEO_THANG / KHONG_GIOI_HAN → ẩn field Số buổi (không gửi hoặc gửi null)

### Format giá
```typescript
new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)
// → "12.500.000 ₫"
```

### Nút thao tác
- "Sửa" → mở modal edit (cam)
- "Ngừng áp dụng" → confirm dialog (đỏ) khi status=ACTIVE
- Khi status=INACTIVE: nút "Ngừng áp dụng" disabled hoặc thay bằng badge "Đã ngừng"
