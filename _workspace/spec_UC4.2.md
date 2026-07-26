# Spec UC4.2 — Khai báo thiết bị

## Tổng quan
- **Tên:** Khai báo thiết bị
- **Vai trò:** ADMIN
- **Route:** `/admin/equipment`
- **Giao diện tham chiếu:** Hình 53–55

---

## Luồng cơ bản

1. Admin vào trang "Thiết bị" → hệ thống hiển thị danh sách thiết bị (bảng cột: **Mã thiết bị | Tên | Loại | Vị trí/Phòng | Ghi chú | Thao tác**)
2. Admin nhấn **"+ Thêm thiết bị"** → form nhập liệu
3. Admin điền Mã thiết bị(*), Tên(*), Loại(*), Vị trí/Phòng, Ghi chú → nhấn "Lưu"
4. Backend kiểm tra: mã thiết bị chưa tồn tại → lưu `equipment` → trả về thiết bị mới
5. Toast thành công, cập nhật danh sách

---

## Luồng phụ & Luồng thay thế

### E-1 — Mã thiết bị trùng (Hình 54)
- Backend trả về lỗi, frontend highlight đỏ trường **Mã thiết bị**
- Thông báo lỗi: **"Mã thiết bị đã tồn tại"**

### E-2 — Thiếu trường bắt buộc
- Highlight các trường trống (Mã thiết bị, Tên, Loại)
- Thông báo dưới từng trường: **"Trường này là bắt buộc"**

### S-1 — Sửa thiết bị
- Nhấn "Sửa" → form prefill dữ liệu hiện tại → nhấn "Cập nhật"
- Không cho phép sửa Mã thiết bị (read-only khi edit)

### S-2 — Ngừng hoạt động (soft delete)
- Nhấn "Xóa" → hộp thoại xác nhận **"Bạn có chắc muốn ngừng thiết bị này?"**
- Xác nhận → `PATCH /api/equipment/{id}/status` → đổi `status = INACTIVE`
- Thiết bị INACTIVE ẩn khỏi danh sách bán nhưng vẫn giữ trong DB

---

## Business Rules

1. `equipment.code` là **UNIQUE** trên toàn hệ thống
2. **Soft delete**: đổi `status = INACTIVE`, không xóa vật lý (consistent với R BR mục 5.9)
3. Số thiết bị theo loại (`type`) là **cơ sở tham chiếu cho sức chứa tối đa** khi tạo lớp (UC4.1):
   - API `GET /api/equipment/count-by-type` trả về `{ type: string, count: number }[]`
   - Dùng ở form tạo lớp UC4.1: hiển thị gợi ý **"Loại [X] hiện có N máy"** khi admin chọn loại thiết bị
4. **Audit log**: ghi khi thêm/sửa/ngừng thiết bị (`action = "CREATE_EQUIPMENT"` / `"UPDATE_EQUIPMENT"` / `"DEACTIVATE_EQUIPMENT"`, `entity = "equipment"`)

---

## Data Model

```sql
equipment(
  id           BIGINT AUTO_INCREMENT PK,
  code         VARCHAR(50) NOT NULL UNIQUE,   -- Mã thiết bị
  name         VARCHAR(100) NOT NULL,          -- Tên
  type         VARCHAR(100) NOT NULL,          -- Loại (text tự do, vd: "Reformer", "Mat", "Chair")
  location     VARCHAR(100),                   -- Vị trí/Phòng
  note         TEXT,                           -- Ghi chú
  status       ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

Flyway migration: **V2__create_equipment_table.sql** (V1 đã dùng cho member_package)

---

## API Endpoints

```
GET    /api/equipment                   (ADMIN) — danh sách thiết bị (mặc định chỉ ACTIVE, ?includeInactive=true để xem cả INACTIVE)
POST   /api/equipment                   (ADMIN) — thêm mới
PUT    /api/equipment/{id}              (ADMIN) — sửa (trừ code)
PATCH  /api/equipment/{id}/status       (ADMIN) — ngừng hoạt động (set INACTIVE)
GET    /api/equipment/count-by-type     (ADMIN) — đếm số lượng theo loại (cho UC4.1)
```

### POST /api/equipment — Request
```json
{
  "code": "REF-09",
  "name": "Máy Reformer 09",
  "type": "Reformer",
  "location": "Phòng A",
  "note": "Mua năm 2025"
}
```

### GET /api/equipment — Response
```json
[
  {
    "id": 1,
    "code": "REF-01",
    "name": "Máy Reformer 01",
    "type": "Reformer",
    "location": "Phòng A",
    "note": "",
    "status": "ACTIVE"
  }
]
```

### GET /api/equipment/count-by-type — Response
```json
[
  { "type": "Reformer", "count": 8 },
  { "type": "Mat", "count": 1 }
]
```

### Error responses (tiếng Việt đúng nguyên văn)
```json
{ "field": "code",  "message": "Mã thiết bị đã tồn tại" }
{ "field": "code",  "message": "Trường này là bắt buộc" }
{ "field": "name",  "message": "Trường này là bắt buộc" }
{ "field": "type",  "message": "Trường này là bắt buộc" }
```

---

## UI/UX (CLAUDE.md mục 6)

- **Layout:** sidebar teal đậm + header trắng tiêu đề **"Quản lý Thiết bị"**, badge "Admin – …" góc phải
- **Bảng:** header xám nhạt, hover highlight, cột: Mã thiết bị | Tên | Loại | Vị trí/Phòng | Ghi chú | Thao tác
- **Nút "+ Thêm thiết bị":** teal solid, góc trên phải bảng
- **Thao tác mỗi hàng:** nút **"Sửa"** (cam `#F59E0B`) + nút **"Xóa"** (đỏ `#EF4444`)
- **Form (modal hoặc drawer):** các trường Mã thiết bị(*), Tên(*), Loại(*), Vị trí/Phòng, Ghi chú; lỗi = viền đỏ + text đỏ ngay dưới trường
- **Xóa:** `ConfirmDialog` với nút xác nhận đỏ
- **Toast thành công:** xanh lá góc phải — "Thêm thiết bị thành công!" / "Cập nhật thành công!" / "Đã ngừng hoạt động thiết bị."

---

## Files Backend cần tạo

```
com/picore/equipment/
├── Equipment.java                    (Entity)
├── EquipmentRepository.java
├── EquipmentService.java             (@PreAuthorize ADMIN, audit_log)
├── EquipmentController.java
└── dto/
    ├── CreateEquipmentRequest.java   (record: code, name, type, location, note)
    ├── UpdateEquipmentRequest.java   (record: name, type, location, note — không có code)
    └── EquipmentResponse.java        (record)

db/migration/V2__create_equipment_table.sql
```

Pattern tham chiếu: `com/picore/packageplan/` (Entity + Repo + Service + Controller + DTOs records)

---

## Files Frontend cần tạo

```
src/pages/admin/AdminEquipmentPage.tsx    (page chính: bảng + modal thêm/sửa + confirm xóa)
src/api/equipment.ts                       (axios: getEquipment, createEquipment, updateEquipment, deactivateEquipment, countByType)
src/types/equipment.ts                     (Equipment interface, CreateEquipmentRequest, EquipmentCountByType)
```

Thêm route `/admin/equipment` vào `App.tsx` (ADMIN only).  
Thêm menu item **"Thiết bị"** vào `Sidebar.tsx` cho ADMIN (sau "Lớp học", trước "Tài chính").

---

## Seed data tham chiếu (CLAUDE.md mục 9)

```sql
-- 8 máy Reformer + thảm Mat (đã đề cập trong seed)
INSERT INTO equipment (code, name, type, location, note) VALUES
  ('REF-01','Máy Reformer 01','Reformer','Phòng A',''),
  ('REF-02','Máy Reformer 02','Reformer','Phòng A',''),
  ...
  ('REF-08','Máy Reformer 08','Reformer','Phòng B',''),
  ('MAT-01','Thảm Mat 01','Mat','Phòng B','');
```
