# UC3.1 Backend — Cấu hình loại gói tập — DONE

## 1. Files created (package `com.picore.packageplan`)

```
backend/src/main/java/com/picore/packageplan/
├── PackageType.java              JPA entity (NO Lombok), nested enums PackageCategory + PackageStatus
├── PackageTypeRepository.java    JpaRepository<PackageType, Long>
├── PackageTypeService.java       @Service @Transactional — business rules + audit
├── PackageTypeController.java    @RestController @RequestMapping("/package-types")
└── dto/
    ├── PackageTypeResponse.java       record + static from(PackageType)
    ├── CreatePackageTypeRequest.java  record (@NotBlank/@NotNull/@Positive)
    └── UpdatePackageTypeRequest.java  record (same shape)
```

Compiled successfully with `mvn -o compile`. No existing files modified (SecurityConfig, GlobalExceptionHandler, pom.xml, application.yml untouched).

## 2. API contract

Context path is `/api` (from application.yml), so full paths are `/api/package-types...`.

| Method | Path | Roles | Success | Body |
|--------|------|-------|---------|------|
| GET  | `/package-types` | ADMIN, RECEPTIONIST | 200 | `PackageTypeResponse[]` (all, ordered by id) |
| GET  | `/package-types/active` | ADMIN, RECEPTIONIST | 200 | `PackageTypeResponse[]` (status=ACTIVE only — for UC3.2 dropdown) |
| POST | `/package-types` | ADMIN | 201 | `PackageTypeResponse` |
| PUT  | `/package-types/{id}` | ADMIN | 200 | `PackageTypeResponse` |
| PATCH| `/package-types/{id}/status` | ADMIN | 200 | `PackageTypeResponse` (toggled) |

### PackageTypeResponse (JSON)
```json
{
  "id": 1,
  "name": "Gói 10 buổi",
  "category": "THEO_BUOI",      // THEO_BUOI | THEO_THANG | KHONG_GIOI_HAN | GOI_1_1 | GOI_1_2
  "sessions": 10,               // number, or null for THEO_THANG / KHONG_GIOI_HAN
  "durationDays": 30,
  "price": 2500000,             // Long, plain number (no formatting) — format client-side
  "description": "…",           // nullable
  "status": "ACTIVE"            // ACTIVE | INACTIVE
}
```

### Create / Update request (identical shape)
```json
{
  "name": "Gói 10 buổi",        // required, unique
  "category": "THEO_BUOI",      // required, must be one of the 5 enum values
  "sessions": 10,               // required(>0) for THEO_BUOI/GOI_1_1/GOI_1_2; ignored & forced null otherwise
  "durationDays": 30,           // required, > 0
  "price": 2500000,             // required, > 0 (Long)
  "description": "…"            // optional
}
```

## 3. Error responses (consumed by GlobalExceptionHandler)

- **Field errors from bean validation** (`@NotBlank/@NotNull/@Positive`) return an **array**: `[{"field":"...","message":"..."}]`, HTTP 400.
- **Business-rule errors** (`ApiException` with field) return a **single object**: `{"field":"...","message":"..."}`, HTTP 400.

Business-rule messages the frontend should surface:
| Field | Message | Trigger |
|-------|---------|---------|
| `name` | `Tên gói tập đã tồn tại` | duplicate name (create + update; also on DB race) |
| `category` | `Phân loại không hợp lệ` | category not one of the 5 enums |
| `sessions` | `Số buổi là bắt buộc với loại gói này` | THEO_BUOI/GOI_1_1/GOI_1_2 with sessions null or ≤ 0 |
| (message only) | `Không tìm thấy loại gói tập` | PUT/PATCH on unknown id → HTTP 404 |

Note: `@Positive` on `durationDays`/`price` yields a default validation message. If Vietnamese text ("Giá phải lớn hơn 0", "Thời hạn phải lớn hơn 0") is desired on those fields, add `message=` to the annotations — not done here to keep DTOs matching the spec signatures.

## 4. Notes for the frontend agent

- **Price is a raw Long** (e.g. `2500000`) — apply `Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND'})` client-side.
- **sessions conditional**: when category ∈ {THEO_THANG, KHONG_GIOI_HAN}, backend stores/returns `sessions: null` regardless of what you send — safe to omit or send null. Show "—" in the table for null.
- **status toggle is bidirectional** — one PATCH endpoint flips ACTIVE↔INACTIVE. The "Ngừng áp dụng" button and any future "Áp dụng lại" both hit the same endpoint; UI decides based on current status.
- **Soft delete**: no DELETE endpoint. Deactivation via PATCH `/status` only; records are never removed.
- Validation errors arrive as an **array**, business errors as a **single object** — the form error handler must accept both shapes (same convention as the Member module UC).
- Audit actions recorded: `CREATE_PACKAGE_TYPE`, `UPDATE_PACKAGE_TYPE`, `TOGGLE_PACKAGE_TYPE_STATUS` (entity `PackageType`).
