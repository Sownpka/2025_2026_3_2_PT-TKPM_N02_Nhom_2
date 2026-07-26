# Frontend UC4.4 — Xem lịch dạy của HLV — DONE

## Kết quả
`npx tsc --noEmit` PASS (strict + noUnusedLocals/noUnusedParameters). Không lỗi.

## Files tạo mới
- `frontend/src/api/trainerSchedule.ts`
  - Interface `SessionItem`, `TrainerScheduleResponse`, type `SessionType`, `BackendDayOfWeek`.
  - `fetchTrainerSchedule(week?)` → `GET /api/trainer/schedule?week={week}` (bỏ param nếu `week` undefined).
  - Dùng lại endpoint constant có sẵn `TRAINER_API.SCHEDULE` trong `api/endpoints.ts`.
- `frontend/src/pages/trainer/TrainerSchedulePage.tsx`
  - State: `data`, `loading`, `error`, `weekMonday` (khởi tạo = Monday tuần hiện tại).
  - Week helpers viết mới (dựa trên `Date` của Monday, giờ địa phương): `getThisMonday`, `getMondayOfDate`, `addWeeks`, `addDays`, `getISOWeekString`, `formatWeekLabel`, `fmtDayMonth`.
  - `useEffect` fetch theo `weekMonday` với active-flag (không dùng React Query).
  - Lưới 7 cột T2→CN, card theo type (GROUP=teal, PRIVATE_1_1=xanh dương, PRIVATE_1_2=tím), sort theo `startTime`.
  - Click card → `navigate('/trainer/session/{sessionId}/attendees')` (UC5.5, làm sau).
  - E-1 tuần trống → "Chưa có lịch dạy trong tuần này".

## Files sửa
- `frontend/src/App.tsx` — import `TrainerSchedulePage`, thay Placeholder route `/trainer/schedule` bằng `<TrainerSchedulePage />` (vẫn trong nhóm `ProtectedRoute allowedRoles={['TRAINER']}`).

## Files KHÔNG cần sửa (đã có sẵn)
- `frontend/src/components/Sidebar.tsx` — TRAINER menu đã có `{ label: 'Lịch dạy', path: '/trainer/schedule' }`.
- `frontend/src/components/Layout.tsx` — `PAGE_TITLES` đã có `'/trainer/schedule': 'Lịch dạy của tôi'`.

## Lưu ý khác spec (đã điều chỉnh cho khớp codebase)
- **dayOfWeek đầy đủ**: backend trả `"MONDAY".."SUNDAY"` (không phải `MON..SUN` như `types/trainer.ts`). Đã định nghĩa type `BackendDayOfWeek` riêng và map cột theo tên đầy đủ.
- **Xử lý lỗi**: dùng `parseApiError(err)[0].message` (chuẩn dự án) thay cho `err.message` để hiện message tiếng Việt từ backend.
- **ISO week**: tính từ `Date` Monday (thứ Năm quyết định năm/tuần). Đã kiểm tra cho ranh giới năm.

## Notes cho QA
- Đăng nhập vai trò TRAINER → vào menu "Lịch dạy" (`/trainer/schedule`).
- Verify HLV chỉ thấy buổi của chính mình (backend lọc theo JWT).
- Verify cả GROUP lẫn PRIVATE_1_1/1_2 hiện trong lưới, đúng cột theo `dayOfWeek`, đúng màu theo `type`.
- Verify card sort theo giờ bắt đầu trong mỗi ngày; hiện `bookedCount/capacity`.
- Verify nút "← Tuần trước" / "Tuần sau →" đổi param `week` (định dạng `YYYY-Www`) và re-fetch; nhãn tuần "Tuần dd/MM – dd/MM/yyyy" + nhãn cột dd/MM cập nhật theo.
- Verify tuần trống → hiện "Chưa có lịch dạy trong tuần này" (E-1).
- Verify click card điều hướng `/trainer/session/{sessionId}/attendees` (route UC5.5 chưa có — sẽ 404/redirect, đúng dự kiến cho tới khi UC5.5 xong).
