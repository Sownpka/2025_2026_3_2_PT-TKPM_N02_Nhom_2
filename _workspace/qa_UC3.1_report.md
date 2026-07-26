# QA Report: UC3.1 — Cấu hình loại gói tập

## Summary
**PASS with warnings** — All core integration points are implemented correctly end-to-end.
No HIGH bugs. Two MEDIUM message-text deviations from spec and two LOW/informational notes.

## Checks

### Backend
| # | Check | Status | Notes |
|---|-------|--------|-------|
| B1 | Sessions business rule | PASS | `resolveSessions` (Service:141-151) throws `ApiException(400, "sessions", "Số buổi là bắt buộc với loại gói này")` when category ∈ {THEO_BUOI, GOI_1_1, GOI_1_2} and sessions null **or ≤ 0**. |
| B2 | Sessions auto-null | PASS | Same method returns `null` for THEO_THANG / KHONG_GIOI_HAN, ignoring any input value. |
| B3 | Name uniqueness on update | PASS | `existsByNameAndIdNot(name, id)` called in `updatePackageType` (Service:88); repository declares it (Repository:11). Updating to the same name does not error. |
| B4 | `@Positive` annotation | PASS | Both DTOs use `@NotNull @Positive` on `durationDays` and `price`. Constraint behaviour (> 0 only) is correct per spec. (Message text — see Issue #1.) |
| B5 | Endpoint authorization | PASS | GET `/package-types` and GET `/package-types/active`: `@PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")`. POST/PUT/PATCH: `hasRole('ADMIN')`. `@EnableMethodSecurity` present in SecurityConfig:22, so `@PreAuthorize` is active. |
| B6 | `@Valid` on `@RequestBody` | PASS | Present on both create (Controller:48) and update (Controller:58). |
| B7 | Error shape consistency | PASS | Service throws `ApiException` (not raw RuntimeException); GlobalExceptionHandler maps field-bearing `ApiException` → single object `{field,message}`, bean-validation → array `[{field,message}]`. Matches frontend `parseApiError`. |
| B8 | Toggle actually toggles | PASS | `toggleStatus` (Service:116-119) flips ACTIVE→INACTIVE and INACTIVE→ACTIVE based on current status; not a hardcoded set. |

Additional backend verification:
- Entity/columns match spec (name unique, sessions nullable, price Long, status default ACTIVE, `@Enumerated(STRING)`).
- `AuditLogService.log(actorId, action, entity, entityId, detail)` signature matches all three call sites (CREATE / UPDATE / TOGGLE_PACKAGE_TYPE_STATUS).
- `PackageTypeResponse.from` null-safe on category/status.

### Frontend
| # | Check | Status | Notes |
|---|-------|--------|-------|
| F1 | Field-level error display | PASS | `applyErrors` (Page:156-168) builds `fieldErrors` map; `<Field error={fieldErrors.name}>` renders message under Tên gói. Toast only fires for general (non-field) errors. Duplicate-name shows inline, not as toast. |
| F2 | Conditional sessions field | PASS | `handleCategoryChange` clears `sessions` to `''` when switching to a non-session category (Page:114-121). On submit, `sessions` is sent as `null` unless category ∈ SESSION_CATEGORIES **and** value non-empty (Page:178). No stale value leaks. |
| F3 | Price format | PASS | `new Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND'})` used for the table Giá column (Page:35-38, 269). |
| F4 | "Ngừng áp dụng" button state | PASS | Rendered only for `status === 'ACTIVE'`; INACTIVE rows show gray "Đã ngừng" text instead (Page:281-292). |
| F5 | Confirm dialog message | PASS | Verbatim: "Bạn có chắc muốn ngừng áp dụng loại gói này? Các gói hội viên đã mua vẫn được giữ nguyên." (Page:404-407; JSX whitespace collapses to a single space). |
| F6 | Route access (ADMIN only) | PASS | `/admin/package-types` sits inside `<ProtectedRoute allowedRoles={['ADMIN']}>` group (App.tsx:29-40). |
| F7 | Edit prefill | PASS | `openEditModal` populates name, category, sessions, durationDays, price, description (Page:130-142). Null sessions → empty string; null description → empty string. |
| F8 | Post-mutation refresh | PASS | `await loadItems()` after create/update (Page:192) and after toggle (Page:205). |

Additional frontend verification:
- `types/index.ts` adds `PackageCategory` union + `PackageTypeResponse` (uses shared `Status`). Matches API contract.
- `Layout.tsx` PAGE_TITLES maps `/admin/package-types` → "Loại gói tập".
- API client base URL `/api` matches backend context-path `/api`; auth token injected via interceptor.
- Toggle call `client.patch(.../status)` sends no body — matches backend (no `@RequestBody`).

## Issues Found

### [MEDIUM] — @Positive / @NotNull produce English default messages, not the Vietnamese spec text
Spec (lines 43-44) mandates: Giá ≤ 0 → **"Giá phải lớn hơn 0"**, Thời hạn ≤ 0 → **"Thời hạn phải lớn hơn 0"**.
The DTOs use bare `@NotNull @Positive` with no `message=` attribute, and there is **no `ValidationMessages.properties`** in `backend/src/main/resources`. Hibernate Validator therefore returns default English text (e.g. `"must be greater than 0"`, `"must not be null"`).
- Files: `CreatePackageTypeRequest.java:11-12`, `UpdatePackageTypeRequest.java:11-12`.
- Expected: field error under Giá / Thời hạn reads the Vietnamese message.
- Actual: field-level display works (correct field, correct HTTP 400), but the message string is English.
- Fix: add `message = "Giá phải lớn hơn 0"` / `message = "Thời hạn phải lớn hơn 0"` (and Vietnamese `@NotNull`/`@NotBlank` messages) to both DTOs. The backend agent explicitly acknowledged this trade-off in its report.

### [MEDIUM] — Sessions ≤ 0 returns the "required" message instead of "Số buổi phải lớn hơn 0"
Spec distinguishes two sessions errors (lines 41-42): missing → "Số buổi là bắt buộc với loại gói này"; **≤ 0 → "Số buổi phải lớn hơn 0"**.
`resolveSessions` (PackageTypeService.java:143) collapses both `sessions == null` and `sessions <= 0` into the single "bắt buộc" message.
- Expected: sessions = 0 or negative → "Số buổi phải lớn hơn 0".
- Actual: shows "Số buổi là bắt buộc với loại gói này".
- Fix (optional): split the condition — null → "bắt buộc" message; `<= 0` → "Số buổi phải lớn hơn 0".

### [LOW] — Database schema for `package_type` relies on the dev profile
`application.yml` sets `ddl-auto: validate` (no `schema.sql`, no Flyway/Liquibase migration anywhere in resources). The `package_type` table only gets created under the `dev` profile (`application-dev.yml` → `create-drop`). Under the default/prod profile the app will fail schema validation unless the table is created manually.
- This is a project-wide convention (every entity is in the same situation), **not** a UC3.1-specific regression. Flagged for awareness only. Confirm UC3.1 is exercised with the `dev` profile active.

### [LOW] — "Số buổi" field has no required asterisk
When visible, the Số buổi field is required (backend enforces it), but the `<Field label="Số buổi">` has no `required` prop, so no red "*" is shown (Page:338). Cosmetic; validation still works via the returned field error. Spec text lists it as "conditional" without an explicit asterisk, so this is borderline — noting for completeness.

## Verdict
**PASS** (with warnings). Every specified backend and frontend integration check passes. There are no HIGH issues and no blocking integration bugs. The two MEDIUM items are error-message-text deviations from the spec (validation still functions and displays at field level in the correct place); recommend fixing the Vietnamese messages before sign-off if strict spec compliance on message text is required.
