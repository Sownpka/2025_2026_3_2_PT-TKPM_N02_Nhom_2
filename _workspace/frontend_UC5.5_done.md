# Frontend UC5.5 — Xem danh sách học viên (HLV) — DONE

Status: implemented, `npx tsc --noEmit` passed (no type errors).

## Files thay đổi / thêm mới

| File | Thay đổi |
|------|----------|
| `frontend/src/api/endpoints.ts` | **SỬA LỖI** — `TRAINER_API.SESSION_ATTENDEES` từ `/sessions/${id}/attendees` → `/trainer/sessions/${id}/attendees` (key cũ thiếu prefix `/trainer`, gọi sai endpoint). |
| `frontend/src/api/trainerSchedule.ts` | **Append** — types `SessionInfo`, `BookingStatus`, `AttendeeEntry`, `SessionAttendeesResponse` + hàm `fetchSessionAttendees(sessionId)`. |
| `frontend/src/pages/trainer/SessionAttendeesPage.tsx` | **MỚI** — trang danh sách hội viên. |
| `frontend/src/App.tsx` | Thêm import + route `/trainer/session/:sessionId/attendees` trong nhóm TRAINER (allowedRoles=['TRAINER'], bọc trong Layout). |
| `frontend/src/components/Layout.tsx` | **Không đổi** — route có param nên `PAGE_TITLES` (exact match) không khớp → header hệ thống hiện "PiCore". Chấp nhận được vì trang tự render H2 tên buổi học. |

Endpoint gọi: `GET /api/trainer/sessions/{sessionId}/attendees` (baseURL `/api` + `/trainer/sessions/${id}/attendees`), khớp `TrainerScheduleController`.

## Hành vi UI

- **Nút quay lại:** "← Quay lại lịch dạy" → `navigate('/trainer/schedule')`.
- **Header trang (H2):** `{className} — {dd/MM/yyyy} {startTime}–{endTime}`. Format ngày parse "yyyy-MM-dd" → "dd/MM/yyyy".
- **Bảng khi `isPast=false`:** cột Họ tên | SĐT | Trạng thái.
- **Bảng khi `isPast=true`:** thêm cột Điểm danh (render có điều kiện, cả `<th>` lẫn `<td>`).
- **Pill trạng thái đặt:** BOOKED→"Đã đặt" (xanh dương), CANCELLED→"Đã hủy" (xám), ATTENDED→"Đã tập" (xanh lá), NO_SHOW→"No-show" (đỏ).
- **Pill điểm danh:** ATTENDED→"Có mặt" (xanh lá), NO_SHOW→"No-show" (đỏ), còn lại→"—".
- **SĐT null → "—"**.
- **Thứ tự render:** theo đúng thứ tự backend trả về (không sort lại ở FE).
- **E-1 empty:** `attendees.length === 0` → "Chưa có hội viên đăng ký cho buổi này".
- **Loading:** "Đang tải...". **Error:** dùng `parseApiError(err)[0]?.message`.
- **active-flag** trong useEffect để tránh setState sau unmount; dep `[sessionId]`.

## Notes cho QA

- Entry point: click card buổi học trong `/trainer/schedule` (UC4.4) — `TrainerSchedulePage` đã navigate sẵn tới `/trainer/session/${sessionId}/attendees`.
- Verify HLV chỉ xem session của mình: 403 backend → FE hiển thị message lỗi ("Bạn không có quyền xem buổi học này") trong khối đỏ.
- Verify sessionId không tồn tại → 404 "Không tìm thấy buổi học" hiển thị lỗi.
- Verify CANCELLED vẫn hiện trong bảng (không bị lọc).
- Verify cột "Điểm danh" chỉ hiện khi `isPast=true`.
- Verify empty state khi không có booking.
- Verify SĐT null hiển thị "—".
- Header hệ thống (thanh trên cùng) hiện "PiCore" cho trang này — đúng như thiết kế (tên buổi nằm ở H2 trong nội dung trang), không phải bug.
- Truy cập trực tiếp URL với `sessionId` không phải số → useEffect return sớm, không gọi API (trang trống, không crash).
