# Backend UC4.2 — Khai báo thiết bị — DONE

Ngày hoàn thành: 2026-07-18
Trạng thái build: `mvn -o clean compile` → BUILD SUCCESS

## Files đã tạo

```
backend/src/main/java/com/picore/equipment/
├── Equipment.java                       (Entity JPA — table `equipment`, enum EquipmentStatus{ACTIVE,INACTIVE}, @PrePersist set created_at)
├── EquipmentRepository.java             (existsByCode, findAllByOrderByIdAsc, findByStatusOrderByIdAsc, @Query countByType)
├── EquipmentService.java                (@Transactional; create/update/deactivate + audit log; getEquipment; countByType)
├── EquipmentController.java             (@PreAuthorize ADMIN toàn bộ endpoint)
└── dto/
    ├── CreateEquipmentRequest.java      (record: code, name, type, location, note — @NotBlank "Trường này là bắt buộc")
    ├── UpdateEquipmentRequest.java      (record: name, type, location, note — KHÔNG có code)
    ├── EquipmentResponse.java           (record: id, code, name, type, location, note, status)
    └── EquipmentTypeCount.java          (record: type, count — cho count-by-type / UC4.1)

backend/src/main/resources/db/migration/
└── V2__create_equipment_table.sql       (CREATE TABLE equipment + index (type,status) + seed 8 Reformer + 1 Mat)
```

> Ghi chú: thêm 1 DTO ngoài spec — `EquipmentTypeCount.java` — cần cho endpoint `count-by-type`.

## API Endpoints (prefix `/api`, tất cả ADMIN)

| Method | Path | Mô tả |
|--------|------|-------|
| GET  | `/api/equipment?includeInactive=false` | Danh sách thiết bị. Mặc định chỉ ACTIVE; `?includeInactive=true` xem cả INACTIVE |
| POST | `/api/equipment` | Thêm thiết bị mới → 201 CREATED |
| PUT  | `/api/equipment/{id}` | Sửa thiết bị (name, type, location, note — KHÔNG cho sửa code) |
| PATCH| `/api/equipment/{id}/status` | Soft delete: set status = INACTIVE |
| GET  | `/api/equipment/count-by-type` | Trả `[{ type, count }]` (chỉ đếm thiết bị ACTIVE) — cho UC4.1 |

## Business rules đã enforce

1. **code UNIQUE**: kiểm tra `existsByCode` + bắt `DataIntegrityViolationException` → trả `{ "field": "code", "message": "Mã thiết bị đã tồn tại" }` (HTTP 400), khớp GlobalExceptionHandler.
2. **Soft delete**: `deactivate` chỉ đổi `status = INACTIVE`, không xóa vật lý.
3. **Không cho sửa code**: `UpdateEquipmentRequest` không có field code; service không đụng tới `code` khi update.
4. **Audit log** qua `AuditLogService.log`:
   - `CREATE_EQUIPMENT` / `UPDATE_EQUIPMENT` / `DEACTIVATE_EQUIPMENT`, entity = `"equipment"`.
5. **@Transactional** ở tất cả method write (create/update/deactivate); read dùng `@Transactional(readOnly = true)`.
6. **Validation** `@NotBlank(message = "Trường này là bắt buộc")` trên code/name/type → thiếu trường trả về list `{field, message}` đúng nguyên văn spec E-2.

## Kiểm chứng

- `mvn -o clean compile` → BUILD SUCCESS (exit 0), không có warning liên quan module equipment.
- Pattern bám sát `com.picore.packageplan` (records cho DTO, class thường + getter/setter cho Entity, không Lombok).
- Package gốc `com.picore`. Migration đánh số V2 (V1 đã dùng cho member_package).

## Lưu ý cho frontend / bước sau

- Response lỗi trùng mã: object đơn `{ "field": "code", "message": "Mã thiết bị đã tồn tại" }`.
- Response lỗi thiếu trường bắt buộc: **mảng** `[{ "field": "...", "message": "Trường này là bắt buộc" }]` (do `MethodArgumentNotValidException` handler trả list).
- `count-by-type` chỉ đếm thiết bị ACTIVE.
