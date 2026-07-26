# QA Report — UC4.4

## Kết quả: PASS

Xem lịch dạy của HLV tích hợp backend ↔ frontend đầy đủ, đúng spec. Không phát hiện lỗi chặn (blocker). Chỉ có vài ghi chú nhỏ (WARNING) không ảnh hưởng chức năng.

## API Shape: OK
`TrainerScheduleResponse` (record) khớp 1-1 với TS interface:
- `trainerName: String` ↔ `string` OK
- `week: String` ↔ `string` OK
- `sessions: List<SessionItem>` ↔ `SessionItem[]` OK
  - `sessionId: Long` ↔ `number` OK
  - `className: String` ↔ `string` OK
  - `sessionDate: String` (format `yyyy-MM-dd` qua DATE_FMT) ↔ `string` OK
  - `dayOfWeek: String` (`getDayOfWeek().name()` = "MONDAY".."SUNDAY") ↔ `BackendDayOfWeek` OK
  - `startTime/endTime: String` (format `HH:mm` qua TIME_FMT) ↔ `string` OK
  - `bookedCount/capacity: int` ↔ `number` OK
  - `type: String` (`getType().name()`) ↔ `'GROUP'|'PRIVATE_1_1'|'PRIVATE_1_2'` OK (enum backend đúng 3 giá trị)

## Endpoint: OK
- Backend: `@RequestMapping("/trainer")` + `@GetMapping("/schedule")`, context-path `/api` → `GET /api/trainer/schedule`.
- Frontend: `TRAINER_API.SCHEDULE = '/trainer/schedule'` (client baseURL đã có `/api`), `fetchTrainerSchedule(week?)` truyền `params: { week }`, bỏ param khi undefined.
- Param name `week` khớp `@RequestParam(name = "week", required = false)`. OK.

## Business Rules: OK
- **BR-1 OK**: `getSchedule(userId, week)` lấy `TrainerProfile` qua `trainerRepository.findByUserAccountId(userId)`, query dùng `trainer.getId()`. Không có trainerId hardcode, không nhận trainerId từ param. Controller truyền `principal.id()` từ JWT.
- **BR-2 OK**: `sessions.isEmpty()` → trả `List.of()` (HTTP 200, không 404). Frontend `isEmpty = data && data.sessions.length === 0 && !loading` → render E-1.
- **BR-3 OK**: `OCCUPYING = [BOOKED, ATTENDED]`; JPQL `countByClassSessionIdInAndStatusIn` GROUP BY với `b.status IN :statuses`. Không tính CANCELLED/NO_SHOW.
- **BR-4 OK**: `resolveClassName`: GROUP → tên gym_class (fallback "Lớp tập"); PRIVATE_1_1 → tên hội viên qua `findFirstByClassSessionIdAndStatusIn` → `member.getFullName()` (fallback "Buổi 1-1"); PRIVATE_1_2 → "Buổi 1-2".
  - Ghi chú: GROUP fallback là "Lớp tập" thay vì spec ví dụ; đã nêu trong backend_done, chấp nhận được.

## Security: OK
- Controller: `@PreAuthorize("hasRole('TRAINER')")` ở cấp class.
- Frontend: route `/trainer/schedule` nằm trong `<ProtectedRoute allowedRoles={['TRAINER']}>` → `<Layout>`.

## Routing: OK
- App.tsx dòng 98: `/trainer/schedule` → `<TrainerSchedulePage />` (đã thay Placeholder, import dòng 20).
- Sidebar.tsx dòng 29: `TRAINER: [{ label: 'Lịch dạy', path: '/trainer/schedule' }]`.
- Layout.tsx dòng 22: `'/trainer/schedule': 'Lịch dạy của tôi'`.

## UX/Labels: OK
- Nhãn cột `DAY_LABEL`: MONDAY→T2, TUESDAY→T3, WEDNESDAY→T4, THURSDAY→T5, FRIDAY→T6, SATURDAY→T7, SUNDAY→CN. Đúng.
- Màu card `CARD_BG`: GROUP=teal, PRIVATE_1_1=blue (xanh dương), PRIVATE_1_2=purple (tím). Đúng spec.
- Click card → `navigate('/trainer/session/${sessionId}/attendees')`. Đúng.
- Tuần trống → "Chưa có lịch dạy trong tuần này". Đúng.
- Nút "← Tuần trước" / "Tuần sau →" đổi `weekMonday` → useEffect re-fetch theo `[weekMonday]`. Đúng.
- Card sort theo `startTime` trong mỗi ngày; hiện `className`, `startTime–endTime`, `bookedCount/capacity`. Đúng.

## dayOfWeek mapping: OK
Điểm dễ sai đã xử lý đúng: backend trả tên đầy đủ "MONDAY".."SUNDAY"; frontend `DAY_ORDER`/`DAY_LABEL`/filter `s.dayOfWeek === day` đều dùng tên đầy đủ (type `BackendDayOfWeek`). Không dùng nhầm `MON..SUN` của `types/trainer.ts`. Cột hiển thị khớp ngày (`addDays(weekMonday, i)`).

## Issues
- `TrainerSchedulePage.tsx:110` — WARNING — Frontend tính `weekStr` bằng `getISOWeekString` riêng để gửi lên và làm nhãn tuần, không dùng `data.week` do backend chuẩn hóa trả về. Logic ISO week hai bên đã kiểm tra khớp (Thursday quyết định năm/tuần) nên không sai; chỉ là dữ liệu `week` trong response không được dùng để hiển thị. Không ảnh hưởng chức năng.
- `TrainerSchedulePage.tsx` — WARNING — `data.trainerName` không được render ở đâu trên trang. Spec không bắt buộc hiển thị (header lưới chỉ cần nhãn tuần), nên chấp nhận; nếu muốn có thể thêm tên HLV vào tiêu đề.
- `TrainerScheduleService.java:61` — INFO — `trainerName` fallback "HLV" khi `getUserAccount()` null; hợp lý.
- Route đích khi click card (`/trainer/session/{id}/attendees`, UC5.5) chưa tồn tại trong App.tsx → hiện tại click sẽ 404/redirect. Đúng dự kiến cho tới khi UC5.5 hoàn thành.

## Kết luận
UC4.4 PASS. API shape, endpoint, business rules (BR-1..BR-4), security, routing/navigation, UX/nhãn và ánh xạ dayOfWeek đều đúng. Batch count JPQL tránh N+1 đúng chuẩn. Chỉ còn ghi chú nhỏ (không dùng `data.week`/`data.trainerName` để hiển thị) — tùy chọn cải thiện, không phải lỗi. Sẵn sàng tích hợp; card điều hướng sẽ hoạt động đầy đủ sau khi UC5.5 xong.
