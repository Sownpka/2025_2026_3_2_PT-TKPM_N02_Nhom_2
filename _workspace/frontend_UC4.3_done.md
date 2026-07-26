# Frontend UC4.3 — Quản lý huấn luyện viên — DONE

Typecheck: `npx tsc --noEmit` → **EXIT=0** (no errors).

## Files đã tạo

- `frontend/src/types/trainer.ts` — interfaces: `TrainerResponse`, `AvailableAccountResponse`, `CreateTrainerRequest`, `UpdateTrainerRequest`, `ShiftSession`, `TrainerShiftsResponse` + type `DayOfWeek`, `SessionType`.
- `frontend/src/api/trainers.ts` — `trainersApi`: `getAll`, `getAvailableAccounts`, `create`, `update`, `deactivate`, `getShifts(id, week?)`. Dùng `client` (axios, baseURL `/api`). `week` optional → không truyền params khi bỏ trống.
- `frontend/src/pages/admin/AdminTrainersPage.tsx` — page chính: bảng + modal thêm/sửa + lưới lịch tuần + confirm xóa + toast. Local state theo pattern `AdminEquipmentPage` (không Zustand).

## Files đã sửa

1. `frontend/src/App.tsx` — import `AdminTrainersPage`, thay Placeholder route `/admin/trainers` bằng component thật.
2. `frontend/src/components/Sidebar.tsx` — thêm `{ label: 'Huấn luyện viên', path: '/admin/trainers' }` vào ADMIN menu, sau "Thiết bị", trước "Tài chính".
3. `frontend/src/components/Layout.tsx` — thêm PAGE_TITLES `'/admin/trainers': 'Quản lý Huấn luyện viên'` để header hiển thị đúng tiêu đề (file này không có trong task list nhưng bắt buộc để header không rơi về "PiCore").

## Chi tiết implement

### Bảng
- Cột: Họ tên | Email | Chuyên môn | SĐT liên hệ | Tổng giờ dạy tuần này | Trạng thái | Thao tác.
- `totalMinutesThisWeek` format qua `formatMinutes()` → `Math.floor(m/60)` giờ + `m%60` phút, clamp âm về 0 ("0 giờ 0 phút" khi trống).
- Trạng thái: pill xanh "Hoạt động" / pill đỏ "Ngừng hoạt động".
- Thao tác: "Xem lịch" (blue-500 ~ #3B82F6), "Sửa" (amber-500), "Xóa" (red-500).

### Modal thêm HLV
- Gọi `GET /available-accounts` ngay khi mở modal (trong `openAddModal`).
- available-accounts rỗng → hiển thị message E-1 nguyên văn, ẩn form, chỉ có nút "Đóng".
- Dropdown chọn tài khoản (hiển thị `fullName (email)`) + input Chuyên môn + input SĐT.

### Modal sửa HLV
- Prefill specialty + contactPhone. Họ tên read-only (bg xám). Không cho đổi tài khoản. PUT body chỉ `{ specialty, contactPhone }`.

### Modal lưới ca (S-1)
- Lần mở đầu gọi `getShifts(id)` không truyền week → dùng `response.week` chuẩn hoá cho ← →.
- ← → dùng helper ISO week tự viết (không cần date-fns): `parseWeek`, `mondayOfISOWeek`, `toISOWeek`, `shiftWeek` (±7 ngày, xử lý đúng ranh giới năm).
- Nhãn tuần "Tuần dd/mm – dd/mm" tính từ Thứ 2 → CN của `week`.
- Lưới 7 cột T2→CN (map MON→SUN), mỗi session = card teal-50/teal-200 hiển thị `className` + `startTime`–`endTime`. Ô không có session để trống.
- `sessions: []` → dòng "Chưa có lịch dạy trong tuần này." (sẽ là trạng thái mặc định cho tới khi UC4.1/UC5.2 populate class_session).

### Xử lý lỗi
- Tái dùng `parseApiError` + `applyErrors` (chuẩn hoá cả object đơn `{field?,message}` lẫn mảng `[{field,message}]`). Field `userAccountId` được highlight ở dropdown khi backend trả lỗi business.

### Toast (đúng nguyên văn)
- "Thêm hồ sơ huấn luyện viên thành công!" / "Cập nhật thành công!" / "Đã ngừng hoạt động huấn luyện viên."

## Điểm lưu ý cho QA

1. **class_session hiện trống** → cột "Tổng giờ dạy tuần này" luôn "0 giờ 0 phút" và lưới lịch luôn hiển thị "Chưa có lịch dạy trong tuần này." — đây là hành vi ĐÚNG cho tới khi UC4.1/UC5.2 tạo dữ liệu buổi tập. Không phải bug.
2. **HLV sau khi "Xóa" (deactivate) biến mất khỏi bảng** vì `GET /api/trainers` chỉ trả ACTIVE (backend chưa có endpoint list gồm INACTIVE). Khớp business rule.
3. **Week navigation** dùng UTC nội bộ để tránh lệch timezone; nhãn tuần và param `YYYY-Www` khớp với giá trị backend trả về.
4. Test E-1: đăng nhập admin, tạo hồ sơ cho hết tài khoản role=TRAINER rồi mở "+ Thêm HLV" → phải thấy message E-1 thay cho form.
5. Cần backend chạy (Flyway V3 + seed 3 HLV) để bảng có dữ liệu; nếu bảng rỗng hiện "Chưa có huấn luyện viên nào".
