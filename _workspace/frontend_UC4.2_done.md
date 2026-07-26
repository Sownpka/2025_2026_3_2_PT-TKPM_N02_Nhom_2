# Frontend UC4.2 — Khai báo thiết bị — DONE

## Files đã TẠO

| File | Nội dung |
|------|----------|
| `frontend/src/types/equipment.ts` | Interfaces: `EquipmentResponse`, `CreateEquipmentRequest`, `UpdateEquipmentRequest` (không có `code`), `EquipmentCountByType` |
| `frontend/src/api/equipment.ts` | `equipmentApi`: `getAll(includeInactive)`, `create`, `update`, `deactivate`, `countByType` — dùng `client` (axios instance, baseURL `/api`) |
| `frontend/src/pages/admin/AdminEquipmentPage.tsx` | Page chính: bảng + modal thêm/sửa + confirm ngừng hoạt động + toast |

## Files đã SỬA

| File | Thay đổi |
|------|----------|
| `frontend/src/App.tsx` | Import `AdminEquipmentPage`, thay Placeholder route `/admin/equipment` bằng page thật (vẫn nằm trong `ProtectedRoute allowedRoles={['ADMIN']}` + `Layout`) |

## Files KHÔNG cần sửa (đã có sẵn)

- `Sidebar.tsx` — menu item **"Thiết bị"** (`/admin/equipment`) đã tồn tại, đúng vị trí sau "Điểm danh" trước "Tài chính".
- `Layout.tsx` — `PAGE_TITLES['/admin/equipment'] = 'Quản lý thiết bị'` đã có → header trắng + badge Admin render tự động qua `Header`.

## Component chính

- **AdminEquipmentPage**: local state (`useState` + `useEffect`) theo pattern `AdminPackageTypesPage` — KHÔNG dùng Zustand store.
- **Bảng**: cột Mã thiết bị | Tên | Loại | Vị trí/Phòng | Ghi chú | Thao tác. Header `bg-gray-50`, hover `hover:bg-gray-50`. Ô rỗng hiển thị `—`.
- **Nút "+ Thêm thiết bị"**: teal solid (`bg-teal-600 hover:bg-teal-700`), góc trên phải.
- **Thao tác**: "Sửa" (amber-500 ≈ `#F59E0B`) + "Xóa" (red-500 ≈ `#EF4444`).
- **Modal Thêm/Sửa**: overlay `bg-black/50`. Trường Mã thiết bị **read-only khi edit** (nền xám `bg-gray-100`, `cursor-not-allowed`, `readOnly`). Khi sửa KHÔNG gửi `code` lên PUT.
- **ConfirmDialog**: "Bạn có chắc muốn ngừng thiết bị này?" + dòng phụ `code — name`, nút Xác nhận đỏ → `PATCH /api/equipment/{id}/status`.
- **Xử lý lỗi**: tái dùng `parseApiError` (`api/auth.ts`) đã chuẩn hóa CẢ 2 dạng lỗi (object đơn `{field,message}` và mảng `[{field,message}]`) về `ApiError[]`. `applyErrors` map `field → message` → viền đỏ + text đỏ dưới đúng input. Lỗi không có field → toast đỏ.
- **Toast**: xanh lá góc phải, tự ẩn 3s — "Thêm thiết bị thành công!" / "Cập nhật thành công!" / "Đã ngừng hoạt động thiết bị."

## Điểm lưu ý cho QA

1. **E-1 (trùng mã)**: backend trả object đơn `{field:'code', message:'Mã thiết bị đã tồn tại'}` → viền đỏ + text đỏ dưới ô Mã thiết bị. Đã handle qua `parseApiError` (kiểm tra `Array.isArray`).
2. **E-2 (thiếu trường)**: backend trả mảng → highlight từng trường (code/name/type) với "Trường này là bắt buộc".
3. **Không có validation phía client** (theo pattern package types) — form dựa vào backend trả lỗi field. Bấm Lưu với form rỗng sẽ gọi API và nhận lỗi E-2 để highlight. QA xác nhận backend trả đúng shape.
4. **Danh sách mặc định chỉ ACTIVE** (`getAll()` gửi `includeInactive=false`). Thiết bị đã "Xóa" (INACTIVE) biến mất khỏi bảng sau reload — đây là soft delete đúng spec, không phải mất dữ liệu.
5. Nút "Xóa" hiện với MỌI hàng (list chỉ có ACTIVE nên luôn hợp lệ). Khác package types (ẩn nút khi đã INACTIVE) vì ở đây INACTIVE không hiển thị.
6. `countByType()` đã có trong API client nhưng chưa dùng ở page này — để dành cho UC4.1 (gợi ý sức chứa lớp).
7. `npx tsc --noEmit` PASS, không lỗi type.
8. Loại (`type`) là text tự do, có placeholder gợi ý "VD: Reformer, Mat, Chair".
