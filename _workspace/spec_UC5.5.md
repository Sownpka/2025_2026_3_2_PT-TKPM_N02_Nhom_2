# Spec UC5.5 — Xem danh sách học viên (HLV)

## Thông tin chung

- **UC ID:** UC5.5
- **Tên:** Xem danh sách học viên của một buổi học
- **Actor:** TRAINER (Huấn luyện viên)
- **Route:** `/trainer/session/:sessionId/attendees`
- **Màn hình tham chiếu:** Hình 76, 77
- **Entry point:** Click card buổi học trong UC4.4 (`/trainer/schedule`)
- **Dependency:** UC4.4 (lịch dạy), UC5.3 (điểm danh đã ghi vào booking)

---

## Luồng cơ bản

1. HLV click card buổi học trong `/trainer/schedule` → navigate `/trainer/session/{sessionId}/attendees`
2. Hệ thống load thông tin buổi học + danh sách booking
3. Hiển thị bảng hội viên:
   - Họ tên | SĐT liên hệ | Trạng thái đặt | Trạng thái điểm danh (nếu có)
4. Buổi **chưa diễn ra** (sessionDate > today): chỉ hiển thị trạng thái đặt (BOOKED/CANCELLED)
5. Buổi **đã diễn ra** (sessionDate <= today): hiển thị thêm trạng thái điểm danh (ATTENDED/NO_SHOW)

### E-1 — Không có hội viên
- Không có booking nào → "Chưa có hội viên đăng ký cho buổi này"

---

## API Endpoints

```
GET /api/trainer/sessions/{sessionId}/attendees
  - TRAINER only
  - Kiểm tra session thuộc trainer đang đăng nhập (security guard)
  - Response: {
      sessionInfo: {
        sessionId: number,
        className: string,
        sessionDate: string,   // "yyyy-MM-dd"
        startTime: string,     // "HH:mm"
        endTime: string,
        trainerName: string,
        isPast: boolean        // sessionDate <= today
      },
      attendees: Array<{
        bookingId: number,
        memberName: string,
        phone: string | null,
        bookingStatus: "BOOKED" | "CANCELLED" | "ATTENDED" | "NO_SHOW",
        checkedInAt: string | null   // ISO datetime, chỉ có khi ATTENDED
      }>
    }
```

---

## Data model

Dùng bảng đã có:
- `class_session` — info buổi học
- `booking` — danh sách hội viên + status + checked_in_at
- `member` — họ tên + phone
- `gym_class` — tên lớp (nếu GROUP)

---

## Giao diện (Hình 76, 77)

### Header trang
```
[← Quay lại]  {className} — {sessionDate} {startTime}–{endTime}
```
Nút "← Quay lại" → `navigate('/trainer/schedule')`

### Bảng hội viên

**Buổi chưa diễn ra (isPast=false) — Hình 76:**
| Họ tên | SĐT | Trạng thái |
|--------|-----|-----------|
| Nguyễn Văn A | 0901234567 | Đã đặt |
| Trần Thị B | 0912345678 | Đã hủy |

**Buổi đã diễn ra (isPast=true) — Hình 77:**
| Họ tên | SĐT | Trạng thái đặt | Điểm danh |
|--------|-----|--------------|----------|
| Nguyễn Văn A | 0901234567 | Đã đặt | Có mặt |
| Trần Thị B | 0912345678 | Đã đặt | No-show |
| Lê Văn C | 0923456789 | Đã hủy | — |

**Pill trạng thái đặt:**
- BOOKED → pill xanh dương "Đã đặt"
- CANCELLED → pill xám "Đã hủy"
- ATTENDED → pill xanh lá "Đã tập" (trong cột "Trạng thái đặt" khi isPast)
- NO_SHOW → pill đỏ "No-show"

**Pill điểm danh (cột riêng, chỉ hiện khi isPast=true):**
- ATTENDED → pill xanh lá "Có mặt"
- NO_SHOW → pill đỏ "No-show"
- BOOKED/CANCELLED → "—"

**Sắp xếp:** BOOKED/ATTENDED trước, CANCELLED sau; trong mỗi nhóm sort theo memberName.

---

## Notes cho Backend Dev

1. `@PreAuthorize("hasRole('TRAINER')")` + kiểm tra `session.trainerId == trainer.id` (403 nếu sai)
2. Load bookings tất cả status (BOOKED, CANCELLED, ATTENDED, NO_SHOW) — không lọc bỏ CANCELLED
3. `isPast = session.sessionDate.isBefore(LocalDate.now()) || session.sessionDate.isEqual(LocalDate.now())`
4. phone lấy từ `member.phone`, có thể null
5. Batch-load members từ booking.memberId để tránh N+1
6. className logic giống UC4.4 (GROUP → gymClass.name, PRIVATE_* → "Buổi 1-1/1-2")

## Notes cho Frontend Dev

1. Route `/trainer/session/:sessionId/attendees` cần thêm vào App.tsx (trong nhóm TRAINER)
2. Parse `sessionId` từ `useParams()` → truyền vào API call
3. Không có route hiện tại → thêm mới (không phải Placeholder)
4. Nút "← Quay lại" dùng `navigate('/trainer/schedule')` hoặc `navigate(-1)`
5. Cột "Điểm danh" chỉ render khi `sessionInfo.isPast === true`
6. Dùng useState + useEffect + active-flag

## Notes cho QA

- Verify HLV chỉ xem được session của chính mình (403 nếu sessionId của HLV khác)
- Verify CANCELLED booking vẫn hiện trong danh sách (không bị lọc bỏ)
- Verify cột điểm danh chỉ hiện khi isPast=true
- Verify empty state khi không có booking nào
- Verify nút quay lại về `/trainer/schedule`
