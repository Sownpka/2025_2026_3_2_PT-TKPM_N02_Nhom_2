# Spec UC4.4 — Xem lịch dạy (HLV)

## Thông tin chung

- **UC ID:** UC4.4
- **Tên:** Xem lịch dạy của tôi
- **Actor:** TRAINER (Huấn luyện viên)
- **Route:** `/trainer/schedule`
- **Màn hình tham chiếu:** Hình 74 (lưới tuần), Hình 75 (tuần trống)
- **Dependency:** UC4.1 (class_session GROUP), UC5.2 (class_session PRIVATE_1_1/1_2)

---

## Luồng cơ bản

1. HLV vào `/trainer/schedule`
2. Hệ thống lấy `trainerId` từ JWT (userId → TrainerProfile)
3. Hiển thị **lưới tuần** (T2–CN) cho tuần hiện tại
   - Mỗi ô = card buổi học: tên lớp / tên hội viên (với buổi 1-1), giờ bắt đầu–kết thúc, số học viên đăng ký / sức chứa
   - Gồm cả lớp cố định (GROUP) lẫn buổi riêng (PRIVATE_1_1, PRIVATE_1_2)
4. Nút ← → chuyển tuần trước/sau
5. Click vào 1 ô → điều hướng sang UC5.5 (`/trainer/session/:sessionId/attendees`)

### E-1 — Tuần trống (Hình 75)

- Không có buổi nào trong tuần được chọn → hiển thị "Chưa có lịch dạy trong tuần này"

---

## API Endpoints

```
GET /api/trainer/schedule?week=YYYY-Www
  - TRAINER only
  - Trả về danh sách buổi học của HLV đang đăng nhập trong tuần được chỉ định
  - week mặc định = tuần hiện tại nếu không truyền
  - Response: {
      trainerName: string,
      week: string,            // "YYYY-Www"
      sessions: Array<{
        sessionId: number,
        className: string,     // tên lớp hoặc "Buổi 1-1" / "Buổi 1-2" hoặc tên hội viên (với 1-1)
        sessionDate: string,   // "yyyy-MM-dd"
        dayOfWeek: string,     // "MONDAY".."SUNDAY"
        startTime: string,     // "HH:mm"
        endTime: string,       // "HH:mm"
        bookedCount: number,   // số booking BOOKED + ATTENDED
        capacity: number,
        type: "GROUP" | "PRIVATE_1_1" | "PRIVATE_1_2"
      }>
    }
```

---

## Data model

Dùng bảng đã có:
- `class_session` — lấy theo `trainer_id` + `session_date` trong tuần
- `booking` — count booking status IN (BOOKED, ATTENDED) để hiển thị "x/y"
- `gym_class` — tên lớp GROUP
- `member` — tên hội viên cho buổi PRIVATE_1_1

---

## Giao diện (Hình 74, 75)

### Lưới lịch tuần

```
[← Tuần trước]  Tuần dd/MM – dd/MM/yyyy  [Tuần sau →]

        T2    T3    T4    T5    T6    T7    CN
07:00  [card][    ][card][    ][card][    ][    ]
08:00  [    ][card][    ][    ][    ][    ][    ]
...
```

**Thiết kế đơn giản hơn (không phải time-grid):**

Dùng 7 cột (T2→CN), mỗi cột là 1 ngày, liệt kê card các buổi trong ngày đó theo thứ tự giờ. Không cần time-grid chính xác theo pixel — chỉ cần nhóm theo ngày, sắp xếp theo giờ.

**Card buổi học:**
```
┌─────────────────┐
│ Reformer Cơ bản │  ← className
│ 07:00 – 08:00   │  ← startTime – endTime
│ 3/8 học viên    │  ← bookedCount/capacity
└─────────────────┘
```
- GROUP: background teal nhạt
- PRIVATE_1_1: background xanh dương nhạt
- PRIVATE_1_2: background tím nhạt
- Click card → navigate `/trainer/session/{sessionId}/attendees`

**Thanh header tuần:**
- Label: "Tuần {dd/MM} – {dd/MM/yyyy}"
- Nút ← (tuần trước), → (tuần sau)

**Tuần trống (E-1):** ở giữa lưới hiện "Chưa có lịch dạy trong tuần này"

---

## Notes cho Backend Dev

1. `@PreAuthorize("hasRole('TRAINER')")` toàn bộ endpoint
2. Lấy `trainerId`: từ `userId` trong JWT → `TrainerProfile.findByUserAccountId(userId)` (đã có method này từ UC4.3)
3. Query sessions: `ClassSessionRepository.findByTrainerIdAndSessionDateBetweenOrderBySessionDateAscStartTimeAsc(trainerId, monday, sunday)`
4. Đếm booking: batch-load cho tất cả sessionIds trong tuần (tránh N+1)
5. `className` logic:
   - type=GROUP → `gymClass.name`
   - type=PRIVATE_1_1 → tên hội viên đặt buổi đó (query booking → member.fullName), fallback "Buổi 1-1"
   - type=PRIVATE_1_2 → "Buổi 1-2" (nhiều người, không hiện tên cụ thể)
6. `week` param: parse "YYYY-Www" sang monday/sunday như UC5.2. Mặc định = tuần hiện tại.

## Notes cho Frontend Dev

1. Route `/trainer/schedule` — kiểm tra App.tsx đã có chưa
2. Sidebar TRAINER có entry "Lịch dạy" → `/trainer/schedule` (kiểm tra đã có chưa)
3. Layout title: "Lịch dạy của tôi"
4. Week navigation: dùng `currentWeekMonday` state (LocalDate-like trong JS: `Date` hoặc string), tính monday/sunday từ đó
5. ISO week helper: `getISOWeekString(date)` → "YYYY-Www" để truyền vào API
6. Click card → `navigate('/trainer/session/' + session.sessionId + '/attendees')` (route UC5.5 sẽ implement sau)
7. Dùng useState + useEffect, active-flag

## Notes cho QA

- Verify trainer chỉ thấy buổi của chính mình (không thấy buổi của HLV khác)
- Verify GROUP + PRIVATE đều xuất hiện trong lưới
- Verify tuần trống → E-1 message
- Verify week navigation (← →) thay đổi param `week` và re-fetch
- Verify click card navigate đúng URL
