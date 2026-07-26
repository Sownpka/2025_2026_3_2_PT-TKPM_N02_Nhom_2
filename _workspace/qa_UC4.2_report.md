# QA Report UC4.2 — Khai báo thiết bị

Ngày verify: 2026-07-18
Phương pháp: boundary cross-check — đọc song song backend ↔ frontend so khớp contract.

## Kết quả: PASS

Không phát hiện lỗi tích hợp nào gây break. Chỉ có 3 điểm ghi chú nhỏ (cosmetic / cấu hình môi trường), không ảnh hưởng chức năng.

## Checklist
| Hạng mục | Status | Ghi chú |
|----------|--------|---------|
| API Contract | ✅ | 5/5 endpoint khớp URL + method + shape. PUT không gửi `code` cả 2 phía. |
| Error Handling | ✅ | E-1 (object đơn) và E-2 (mảng) khớp chính xác với `parseApiError`. |
| Business Rules | ✅ | Soft delete, code read-only, audit log 3 action đều đúng. |
| Phân quyền | ✅ | Toàn bộ endpoint `@PreAuthorize ADMIN`; route bọc `ProtectedRoute allowedRoles={['ADMIN']}`. |
| UI Labels | ✅ | Toast/nút/confirm/error đúng nguyên văn. 1 lưu ý nhỏ về hoa/thường tiêu đề. |
| Migration | ✅ | Bảng + UNIQUE + index + seed 8 Reformer + 1 Mat đúng. Lưu ý cấu hình Flyway. |

## Chi tiết cross-check

### 1. API Contract — KHỚP HOÀN TOÀN
`client` baseURL = `/api`, controller `@RequestMapping("/equipment")` → mọi path ghép đúng:

| Frontend (`api/equipment.ts`) | Backend (`EquipmentController`) | Khớp |
|---|---|---|
| `GET /equipment?includeInactive` | `GET /equipment` `@RequestParam includeInactive` | ✅ |
| `POST /equipment` | `POST /equipment` → 201 CREATED | ✅ |
| `PUT /equipment/{id}` | `PUT /{id}` | ✅ |
| `PATCH /equipment/{id}/status` (no body) | `PATCH /{id}/status` (không đọc body, lấy actor từ Authentication) | ✅ |
| `GET /equipment/count-by-type` | `GET /count-by-type` | ✅ |

- `EquipmentResponse` (BE record: id, code, name, type, location, note, status) khớp 1-1 với `EquipmentResponse` TS interface. `status` map về TS type `Status = 'ACTIVE'|'INACTIVE'` — BE trả `e.getStatus().name()` cho ra đúng chuỗi này. ✅
- `count-by-type`: BE `EquipmentTypeCount(String type, long count)` ↔ FE `EquipmentCountByType { type: string; count: number }`. `long` → `number` OK. ✅
- **PUT body**: BE `UpdateEquipmentRequest` KHÔNG có `code`; FE `handleSubmit` nhánh edit chỉ gửi `{name, type, location, note}`. Nhất quán tuyệt đối. ✅

### 2. Error Handling — KHỚP CHÍNH XÁC (điểm quan trọng nhất)
Xác minh thực tế `GlobalExceptionHandler`:
- **E-1 trùng mã**: `EquipmentService` ném `ApiException(BAD_REQUEST, "code", "Mã thiết bị đã tồn tại")` (cả 2 đường: `existsByCode` và catch `DataIntegrityViolationException`). Handler `handleApiException` → `ErrorResponse.of(field, message)` → JSON **object đơn** `{ "field": "code", "message": "Mã thiết bị đã tồn tại" }`. `@JsonInclude(NON_NULL)` giữ nguyên field. → FE `parseApiError`: nhánh `!Array.isArray` + `data.message` → trả `[data]` → `applyErrors` map `fieldMap.code` → viền đỏ + text đỏ dưới ô Mã thiết bị. ✅
- **E-2 thiếu trường**: `@NotBlank` trên code/name/type → `MethodArgumentNotValidException` → handler `handleValidation` → **mảng** `[{field, message}]` (message = "Trường này là bắt buộc"). → FE `parseApiError`: nhánh `Array.isArray` → highlight từng field. ✅

Hai dạng response (object vs array) mà FE parse đúng như report backend mô tả — không lệch.

### 3. Business Rules
- **Soft delete**: FE nút "Xóa" → `openConfirmModal` → `handleConfirmDeactivate` gọi `equipmentApi.deactivate` = `PATCH /status`. KHÔNG có lời gọi `DELETE` nào. BE `deactivate` chỉ `setStatus(INACTIVE)` + `save`, không xóa vật lý. ✅
- **Code read-only khi edit**: FE input code `readOnly={isEdit}` + style `bg-gray-100 cursor-not-allowed`; nhánh edit không đưa `code` vào payload PUT. BE update không đụng `code`. ✅
- **Audit log đủ 3 action**: `auditLogService.log(...)` gọi trong `create` (`CREATE_EQUIPMENT`), `update` (`UPDATE_EQUIPMENT`), `deactivate` (`DEACTIVATE_EQUIPMENT`), entity = `"equipment"`. Khớp spec BR mục 4. ✅

### 4. Phân quyền
- Cả 5 method controller đều có `@PreAuthorize("hasRole('ADMIN')")`. ✅
- `App.tsx`: route `/admin/equipment` nằm trong `<ProtectedRoute allowedRoles={['ADMIN']}>` + `<Layout>`. Placeholder cũ đã thay bằng `<AdminEquipmentPage />`. ✅

### 5. UI Labels (đối chiếu nguyên văn)
- Toast: `"Thêm thiết bị thành công!"` / `"Cập nhật thành công!"` / `"Đã ngừng hoạt động thiết bị."` — đúng cả 3. ✅
- Nút thêm: `"+ Thêm thiết bị"` ✅
- Error: `"Mã thiết bị đã tồn tại"` (BE), `"Trường này là bắt buộc"` (BE `@NotBlank`) — hiển thị dưới field. ✅
- Confirm dialog: `"Bạn có chắc muốn ngừng thiết bị này?"` ✅
- Cột bảng: Mã thiết bị | Tên | Loại | Vị trí/Phòng | Ghi chú | Thao tác ✅

### 6. Flyway Migration
- `V2__create_equipment_table.sql`: `code VARCHAR(50) NOT NULL` + `CONSTRAINT uq_equipment_code UNIQUE (code)` ✅; index `(type, status)` ✅.
- Seed: 8 REF-01..08 (Reformer) + 1 MAT-01 (Mat) ✅ đúng CLAUDE.md mục 9.

## Issues (mức độ nhỏ — không block)

1. **[Cosmetic] Tiêu đề trang hoa/thường** — `Layout.tsx:11` đặt `'/admin/equipment': 'Quản lý thiết bị'` (chữ "t" thường), spec ghi **"Quản lý Thiết bị"** (chữ "T" hoa). Ngoài ra `AdminEquipmentPage.tsx:175` dùng h1 phụ `"Danh sách thiết bị"` (không phải tiêu đề header, chấp nhận được). Gợi ý: sửa Layout thành `'Quản lý Thiết bị'` nếu cần khớp tuyệt đối spec.

2. **[Cấu hình] Migration status dùng VARCHAR(20) thay vì ENUM** — `V2__create_equipment_table.sql:14` khai báo `status VARCHAR(20)` thay vì `ENUM('ACTIVE','INACTIVE')` như Data Model spec. Đây là **lựa chọn hợp lý có chủ đích** (JPA map enum-as-string, để `ddl-auto: validate` pass) và đã ghi chú trong comment file. Không phải lỗi, chỉ lưu ý lệch so với chữ trong spec.

3. **[Cấu hình môi trường] Flyway chưa bật** — comment đầu file migration nêu rõ dự án đang dùng Hibernate `ddl-auto` (dev: create-drop), CHƯA cấu hình Flyway. Hệ quả: **seed data trong V2 sẽ KHÔNG tự chạy** ở môi trường dev hiện tại (create-drop tạo bảng rỗng). Bảng `equipment` sẽ trống khi test thủ công trừ khi có `data.sql` riêng hoặc bật Flyway. Không ảnh hưởng verify contract, nhưng QA thủ công cần biết để không nhầm "bảng trống = lỗi". Gợi ý: xác nhận có cơ chế seed khác (data.sql) hoặc bật Flyway trước demo.

## Điểm tốt
- **Error contract khớp tuyệt đối 2 chiều** — điểm khó nhất của UC này. BE phân biệt rõ object đơn (business error) vs mảng (validation), FE `parseApiError` tái dùng chung xử lý cả 2 bằng `Array.isArray`. Không có mismatch.
- **Tái dùng `parseApiError` từ `api/auth.ts`** thay vì viết lại — DRY, giảm rủi ro lệch logic parse.
- `create` chống trùng mã 2 lớp: kiểm tra `existsByCode` trước + bắt `DataIntegrityViolationException` (race condition) — cùng trả 1 message. Robust.
- `countByType` query chỉ đếm ACTIVE (`WHERE status = ACTIVE`) đúng ý đồ tham chiếu sức chứa UC4.1.
- FE trim input (`code/name/type/location/note`) trước khi gửi; `location/note` rỗng gửi `undefined` sạch sẽ.
- Route đã thay Placeholder thật sự (không còn stub), vẫn giữ đúng lớp bảo vệ ADMIN + Layout.
- DTO thừa `EquipmentTypeCount` (ngoài spec) là cần thiết cho endpoint count-by-type — hợp lý, đã ghi chú.
