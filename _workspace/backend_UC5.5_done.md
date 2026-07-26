# Backend UC5.5 — Xem danh sách học viên của HLV — DONE

Status: implemented, `mvn clean compile -q` passed (no errors).

## API

```
GET /api/trainer/sessions/{sessionId}/attendees
Auth: TRAINER only (@PreAuthorize("hasRole('TRAINER')") ở class-level controller)
Security guard: buổi phải thuộc HLV đang đăng nhập → 403 nếu không phải
```

trainerId luôn suy ra từ JWT (`principal.id()`), không nhận từ param.

### Response shape

```jsonc
{
  "sessionInfo": {
    "sessionId": 12,
    "className": "Yoga cơ bản",   // GROUP → gymClass.name; PRIVATE_1_1 → tên HV đầu; PRIVATE_1_2 → "Buổi 1-2"
    "sessionDate": "2026-07-15",  // yyyy-MM-dd
    "startTime": "09:00",         // HH:mm
    "endTime": "10:00",
    "trainerName": "Nguyễn HLV",
    "isPast": true                // sessionDate <= today
  },
  "attendees": [
    {
      "bookingId": 55,
      "memberName": "Nguyễn Văn A",
      "phone": "0901234567",       // nullable
      "bookingStatus": "ATTENDED", // "BOOKED" | "CANCELLED" | "ATTENDED" | "NO_SHOW"
      "checkedInAt": "2026-07-15T09:03:11" // nullable, format yyyy-MM-dd'T'HH:mm:ss (chỉ có khi đã điểm danh)
    }
  ]
}
```

### Hành vi quan trọng (khớp spec)

- Trả **tất cả** booking mọi trạng thái, **không lọc bỏ CANCELLED**.
- Sắp xếp: nhóm BOOKED/ATTENDED/NO_SHOW trước, CANCELLED sau; trong mỗi nhóm sort theo `memberName` (A→Z).
- `isPast = !sessionDate.isAfter(today)` tức `sessionDate <= today`.
- Empty state (E-1): không có booking → `attendees: []` (FE hiển thị "Chưa có hội viên đăng ký cho buổi này").
- `checkedInAt` chỉ khác null khi booking đã điểm danh (thường status ATTENDED). FE cột "Điểm danh" chỉ render khi `sessionInfo.isPast === true`.

### Error responses (dùng ApiException chung của dự án)

- 404 "Không tìm thấy hồ sơ HLV" — user không phải HLV.
- 404 "Không tìm thấy buổi học" — sessionId không tồn tại.
- 403 "Bạn không có quyền xem buổi học này" — session của HLV khác.

## Files thay đổi / thêm mới

| File | Thay đổi |
|------|----------|
| `backend/src/main/java/com/picore/trainer/dto/SessionAttendeesResponse.java` | **MỚI** — record: `SessionInfo` + `AttendeeEntry` |
| `backend/src/main/java/com/picore/booking/BookingRepository.java` | Thêm `findByClassSessionIdOrderByBookedAtAsc(Long)` |
| `backend/src/main/java/com/picore/trainer/TrainerScheduleService.java` | Thêm `getSessionAttendees(userId, sessionId)` + helper `resolveClassNameForSession(...)` + hằng `DATETIME_FMT` |
| `backend/src/main/java/com/picore/trainer/TrainerScheduleController.java` | Thêm endpoint `GET /trainer/sessions/{sessionId}/attendees` |

Không tạo class/service riêng — thêm vào `TrainerScheduleService` hiện có (tái dùng `OCCUPYING`, repositories, DATE/TIME formatter).

## Notes cho Frontend Dev

1. Route `/trainer/session/:sessionId/attendees` — thêm mới vào `App.tsx` (nhóm TRAINER), không phải Placeholder.
2. Parse `sessionId` từ `useParams()` → gọi `GET /api/trainer/sessions/{sessionId}/attendees`.
3. Cột "Điểm danh" chỉ render khi `sessionInfo.isPast === true`.
4. Pill trạng thái đặt: BOOKED→"Đã đặt"(xanh dương), CANCELLED→"Đã hủy"(xám), ATTENDED→"Đã tập"(xanh lá), NO_SHOW→"No-show"(đỏ).
5. Pill điểm danh (cột riêng): ATTENDED→"Có mặt", NO_SHOW→"No-show", còn lại→"—".
6. Nút "← Quay lại" → `navigate('/trainer/schedule')` (hoặc `navigate(-1)`).
7. Empty `attendees` → hiển thị "Chưa có hội viên đăng ký cho buổi này".
8. `phone` và `checkedInAt` có thể null — cần guard khi render.
9. Backend đã sort sẵn đúng thứ tự yêu cầu; FE render theo thứ tự trả về, không cần sort lại.
