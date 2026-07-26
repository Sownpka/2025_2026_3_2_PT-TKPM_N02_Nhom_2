# UC3.1 — Cấu hình loại gói tập (Frontend) — DONE

## 1. Files created / modified

### Created
- `frontend/src/api/packageTypes.ts` — API client wrapper (`packageTypesApi`). Matches spec exactly. Methods return the raw Axios response (caller reads `.data`).
- `frontend/src/pages/admin/AdminPackageTypesPage.tsx` — full page component (table, add/edit modal, confirm dialog, inline toast).

### Modified
- `frontend/src/types/index.ts` — added `PackageCategory` union type + `PackageTypeResponse` interface (uses shared `Status` type).
- `frontend/src/App.tsx` — imported `AdminPackageTypesPage`; replaced the existing `/admin/package-types` placeholder route with the real component (inside the existing nested `ProtectedRoute allowedRoles={['ADMIN']}` + `Layout` group).
- `frontend/src/components/Layout.tsx` — `PAGE_TITLES['/admin/package-types']` changed from `'Quản lý gói tập'` to `'Loại gói tập'`.

## 2. Behaviour implemented (per spec)
- Table columns: Tên gói | Phân loại | Số buổi | Thời hạn (ngày) | Giá | Trạng thái | Thao tác.
- `CATEGORY_LABEL` map for phân loại display.
- Số buổi: shows number or `—` when null.
- Giá: `Intl.NumberFormat('vi-VN', { style:'currency', currency:'VND' })`.
- Status pill: ACTIVE → green "Đang áp dụng", INACTIVE → gray "Ngừng áp dụng".
- "Sửa" (amber) works on both ACTIVE and INACTIVE rows.
- "Ngừng áp dụng" (red) shown only for ACTIVE rows; INACTIVE rows show gray "Đã ngừng" text instead.
- Header: title "Loại gói tập" + teal "+ Thêm loại gói".
- Modal states: `'add' | 'edit' | 'confirm' | null`.
- Form fields: Tên gói*, Phân loại* (5 options), Số buổi (conditional), Thời hạn (ngày)*, Giá*, Mô tả.
- Conditional Số buổi: visible only for THEO_BUOI / GOI_1_1 / GOI_1_2. Switching to THEO_THANG / KHONG_GIOI_HAN clears the value and hides the field; on submit `sessions` is sent as `null` when hidden.
- Field-level errors via `fieldErrors: Record<string,string>`, parsed with `parseApiError` (handles both `{field,message}` and `[{field,message}]` shapes). Non-field / general errors fall back to a red toast.
- Confirm dialog message + "Hủy"/"Xác nhận" buttons per spec.
- Inline toast, auto-dismiss 3s, green success / red error.
- Data loaded on mount (useEffect) with "Đang tải..." state; fetch error → red toast.
- Every mutation (create/update/toggle) re-fetches via `getAll()`.
- Form + fieldErrors reset on modal open (add = empty, edit = prefilled).
- Modal titles "Thêm loại gói" / "Chỉnh sửa loại gói"; submit button "Lưu" / "Cập nhật".

## 3. Integration notes for QA
- The API client (`src/api/client.ts`) returns the full Axios response; the page reads `res.data`. Auth token is injected automatically from the Zustand store (`src/stores/auth.ts`).
- Number inputs are kept as strings in form state and converted on submit. Empty Thời hạn/Giá are sent as `NaN`, which serialises to `null` in JSON — backend `@Positive`/`@NotNull` validation will reject these and the returned field error is displayed under the field. (Client does not pre-validate numeric required fields; it relies on backend validation, consistent with the members page pattern.)
- `sessions` payload is `null` whenever the selected category is not one of THEO_BUOI/GOI_1_1/GOI_1_2, or when the field is left blank.
- Route is ADMIN-only (existing `ProtectedRoute allowedRoles={['ADMIN']}`). RECEPTIONIST has read access on the backend but no UI route was requested for this UC.
- `npx tsc --noEmit` passes with no errors (TS strict, no `any`).

## 4. Deviations from spec (and why)
1. **Toast implementation.** Spec said "same pattern as ReceptionMembersPage" (shared `Toast` component), but that component is hard-coded green-only, while the spec also requires red error toasts. I implemented an inline toast element in the page with a `type: 'success' | 'error'` field (green/red) instead of reusing the green-only component. Still inline state, no library.
2. **Route wiring.** The spec's `App.tsx` snippet wrapped each route in its own `<ProtectedRoute><Layout>...`. The actual `App.tsx` uses a nested layout-route structure and already had a `/admin/package-types` placeholder. I replaced that placeholder with the real component inside the existing ADMIN group rather than adding the spec's duplicate structure — same access control, no double-wrapping.
3. **`UpdatePackageTypePayload`.** Kept as `extends CreatePackageTypePayload` exactly as given (empty interface). ESLint `no-empty-interface` is not enabled in this project, so it is fine.
4. Added a `PackageCategory` union type in `types/index.ts` (spec only asked for `PackageTypeResponse`) so `category` and the response are strongly typed instead of a bare string.
