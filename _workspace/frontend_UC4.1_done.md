## Frontend done: UC4.1 — Quản lý lớp học

`npx tsc --noEmit` → PASS (không lỗi type).

### Files created
- `src/types/class.ts` — TypeScript interfaces
- `src/api/classes.ts` — axios functions (dùng constants CLASSES từ endpoints.ts)
- `src/pages/admin/AdminClassesPage.tsx` — page chính 2 tab

### Files modified
- `src/App.tsx` — thay Placeholder `/admin/classes` bằng `AdminClassesPage` thật
- `src/api/trainers.ts` — thêm `getAvailableForClass(days, startTime, endTime)` (params: `days` CSV, `startTime`, `endTime`)

### Files KHÔNG cần sửa
- `src/api/equipment.ts` — `countByType()` đã có sẵn từ UC4.2
- `src/types/equipment.ts` — `EquipmentCountByType` đã có sẵn

### TypeScript types defined (src/types/class.ts)
- `GymClassResponse` — { id, name, equipmentType, trainerId, trainerName, daysOfWeek: DayOfWeek[], startTime, endTime, capacity, description, status }
- `CreateClassRequest` / `UpdateClassRequest` (alias) — { name, equipmentType, trainerId: number, daysOfWeek, startTime, endTime, capacity: number, description }
- `TimetableSession` — { sessionId, gymClassId, className, trainerName, sessionDate, dayOfWeek, startTime, endTime, capacity, bookedCount, availableSpots }
- `TimetableResponse` — { week, sessions: TimetableSession[] }
- `AvailableTrainerResponse` — { id: number, fullName: string }
- Tái dùng `DayOfWeek` từ `types/trainer.ts` ('MON'..'SUN')

### Routes added
- `/admin/classes` → ADMIN → `AdminClassesPage` (guard qua ProtectedRoute allowedRoles={['ADMIN']} có sẵn)
  - Lưu ý: backend cho cả ADMIN + RECEPTIONIST, nhưng App.tsx hiện chỉ mount route dưới nhánh ADMIN. RECEPTIONIST chưa có route `/reception/classes` trong sidebar/App — nằm ngoài scope UC4.1 frontend files list.

### Điểm lưu ý cho QA
1. **startTime/endTime**: backend trả "08:00:00", FE cắt HH:mm bằng `hhmm()` (slice 5) ở cả bảng, card timetable và prefill form. Gửi lên backend dạng "HH:mm" (từ `<input type=time>`).
2. **daysOfWeek**: pills bảng map MON→T2..SUN→CN, render theo thứ tự cố định DAY_ORDER (T2→CN) bất kể thứ tự backend trả. Form gửi mảng đã sort MON..SUN.
3. **Dropdown HLV**: disabled + placeholder "Chọn ngày và giờ trước" khi chưa đủ (≥1 ngày + giờ bắt đầu + giờ kết thúc). Khi đủ → gọi `/trainers/available-for-class` (useEffect, có cancel chống race). Edit mode: HLV đang gán được prepend vào options nếu không nằm trong list khả dụng (tránh mất selection).
4. **Gợi ý số máy**: fetch `countByType` 1 lần khi mở modal, match theo `equipmentType` (trim + lowercase) → "Hiện có N máy loại này" (N=0 nếu không khớp). Chỉ hiện khi ô loại thiết bị có nội dung.
5. **Error handling**: `applyErrors` xử lý cả 2 dạng — mảng `[{field,message}]` (@Valid, "Trường này là bắt buộc") map vào từng field; object đơn `{field?,message}` (E-1 name, E-3 trainerId, endTime) map field tương ứng hoặc toast nếu không field. Dùng `parseApiError` chung (Array.isArray).
6. **Toast**: "Thêm lớp học thành công!" / "Cập nhật lớp học thành công!" / "Đã ngừng hoạt động lớp học." — đúng nguyên văn.
7. **Confirm xóa**: "Bạn có chắc muốn ngừng lớp học này? Tất cả lịch tập tương lai của lớp sẽ bị hủy." — đúng nguyên văn.
8. **Timetable tab**: lazy-load lần đầu chuyển tab; nút ← → dùng ISO week helper (shiftWeek). Card: tên lớp (bold) + HLV + giờ + "X chỗ" (availableSpots). Rỗng → "Chưa có lớp nào trong tuần này.".
9. Sau create/update/deactivate: reload danh sách; nếu timetable đã load thì reload lại đúng tuần đang xem để đồng bộ.

### Issues / TODO
- RECEPTIONIST route cho trang này chưa tồn tại (ngoài scope file list UC4.1). Nếu cần lễ tân truy cập, phải thêm route `/reception/classes` + mục sidebar sau.
