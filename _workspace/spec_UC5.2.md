# Spec UC5.2 — Đăng ký buổi 1-1/1-2

## Thông tin chung

- **UC ID:** UC5.2
- **Tên:** Đăng ký buổi 1-1 / 1-2 hằng tuần
- **Actor:** MEMBER có gói GOI_1_1 hoặc GOI_1_2
- **Route:** `/member/private-booking`
- **Màn hình tham chiếu:** Hình 69, 70, 71
- **Dependency:** Cần gói ACTIVE loại GOI_1_1 hoặc GOI_1_2; HLV phải còn khung giờ trống

---

## Luồng cơ bản

1. Hội viên vào `/member/private-booking`
2. Hệ thống kiểm tra hội viên có gói GOI_1_1/GOI_1_2 ACTIVE không
3. Nếu có → hiển thị **danh sách HLV** kèm **các khung giờ còn trống trong tuần kế tiếp**
   - Khung giờ trống = chưa có ClassSession (GROUP hoặc PRIVATE) nào của HLV đó trong khung đó
   - Ca hoạt động phòng tập: 06:00–12:00 (sáng) và 13:00–19:00 (chiều), bước 1 giờ → tối đa 12 slot/ngày/HLV
   - Hiển thị theo ngày × HLV
4. Hội viên chọn HLV + ngày + khung giờ (1 giờ)
5. **Gói 1-2**: thêm bước chọn đồng hành:
   - "Mời hội viên khác" (nhập email/SĐT) HOẶC
   - "Để hệ thống ghép" (vào waitlist ghép cùng khung giờ)
6. Xác nhận → backend:
   - Kiểm tra lại khung giờ còn trống (E-3)
   - Tạo `ClassSession` type=PRIVATE_1_1 hoặc PRIVATE_1_2, capacity=1 hoặc 2
   - Tạo `Booking` (status=BOOKED) cho hội viên
   - Trừ 1 buổi từ gói
   - Gói 1-2 ghép: nếu chọn mời hội viên cụ thể → tạo thêm booking cho họ (trừ gói của họ nếu có)
   - Kích hoạt UC5.4 (thông báo xác nhận cho hội viên VÀ HLV)
7. Toast thành công

---

## Luồng thay thế

### E-1 — Quá hạn đăng ký (Hình 71)
- Kiểm tra deadline: **23:59 Chủ Nhật** của tuần hiện tại
- Nếu quá deadline → "Đã hết hạn đăng ký cho tuần này. Vui lòng đăng ký cho tuần kế tiếp."
- Hệ thống tự chuyển sang hiển thị tuần kế tiếp tiếp theo (tuần+2)

### E-2 — Gói không thuộc 1-1/1-2
- Không có gói ACTIVE loại GOI_1_1/GOI_1_2
- Hiển thị: "Bạn chưa có gói 1-1/1-2 còn hiệu lực. Vui lòng liên hệ lễ tân để đăng ký gói phù hợp."
- Không hiển thị form chọn HLV

### E-3 — Khung giờ đã bị đặt trước (race condition)
- Backend kiểm tra lại khi confirm → khung giờ đã có người khác đặt
- Trả về lỗi: "Khung giờ này vừa được đặt bởi người khác. Vui lòng chọn khung giờ khác."
- Frontend: đóng confirm modal, refresh danh sách slot

### E-4 — Gói 1-2 chưa ghép được (CUSTOM chỉ cho 1-2)
- Hội viên muốn "Để hệ thống ghép" nhưng chưa có ai chờ cùng slot
- Dialog: "Hiện chưa có ai chờ ghép cùng khung giờ này."
  - Nút "Vào danh sách chờ ghép" → thêm vào waitlist-1-2 (sẽ ghép khi có người thứ 2)
  - Nút "Tập một mình khung giờ này" → tạo session capacity=2, booking 1 người (chờ thêm)

### S-1 — Hủy buổi 1-1/1-2
- Từ "Lịch tập của tôi" (UC5.1 MyBookingsPage) — tab "Sắp diễn ra"
- Hủy trước deadline → hoàn buổi + mở lại khung giờ HLV (xóa ClassSession nếu không còn ai đặt)
- Đã được xử lý một phần ở UC5.1 `DELETE /bookings/{id}` — cần thêm logic xóa ClassSession orphan

---

## API Endpoints

```
GET /api/private-booking/slots?week=YYYY-Www
  - MEMBER only
  - Trả về danh sách HLV × ngày × khung giờ trống của tuần được chỉ định
  - Backend tự xác định tuần nào cần show (xem mục deadline bên dưới)
  - Response: {
      targetWeek: string,            // tuần đang show ("YYYY-Www")
      deadlinePassed: boolean,        // true nếu đã quá deadline của tuần kế tiếp
      slots: Array<{
        trainerId: number,
        trainerName: string,
        date: string,               // "yyyy-MM-dd"
        dayOfWeek: string,          // "MON".."SUN"
        startTime: string,          // "08:00"
        endTime: string,            // "09:00"
        available: boolean          // true = còn trống
      }>
    }

POST /api/private-booking
  - MEMBER only
  - Body: {
      classSessionId?: number,      // null nếu slot chưa có session → backend tạo mới
      trainerId: number,
      date: string,                 // "yyyy-MM-dd"
      startTime: string,            // "08:00"
      memberPackageId: number,
      partnerMemberId?: number,     // cho gói 1-2 mời cụ thể
      joinMatchmaking?: boolean     // cho gói 1-2 nhờ ghép
    }
  - Response: BookingResponse (id, classSessionId, status, bookedAt)
  - Error 409: "Khung giờ này vừa được đặt bởi người khác"
  - Error 422: "Bạn chưa có gói 1-1/1-2 còn hiệu lực"
  - Error 400: "Đã hết hạn đăng ký cho tuần này"
```

---

## Logic deadline (Business rule 3, CLAUDE.md)

```
PRIVATE_BOOKING_DEADLINE = Chủ Nhật 23:59 của tuần hiện tại
(hằng số cấu hình, mặc định SUNDAY 23:59)

Khi user vào trang:
- Tính tuần kế tiếp (current + 1 week)
- Nếu now <= Chủ Nhật 23:59 tuần hiện tại → targetWeek = tuần kế tiếp, deadlinePassed = false
- Nếu now > Chủ Nhật 23:59 tuần hiện tại → targetWeek = tuần kế tiếp+1 (tuần+2), deadlinePassed = true
  → hiển thị banner E-1 nhưng vẫn cho đăng ký tuần tiếp theo

Khi POST /private-booking:
- Kiểm tra date nằm trong targetWeek hợp lệ (phải là tuần kế tiếp hoặc tuần+2 tùy deadline)
- Nếu date ở tuần đã qua deadline → 400 "Đã hết hạn đăng ký"
```

---

## Logic slot trống

```
Slot trống = khung giờ (trainerId, date, startTime–endTime) KHÔNG có ClassSession nào:
  WHERE trainer_id = ? AND session_date = ? AND
  NOT (end_time <= :slotStart OR start_time >= :slotEnd)
  AND status ACTIVE (nếu có field status trên ClassSession)

Ca sáng: 06:00–07:00, 07:00–08:00, ..., 11:00–12:00 (6 slots)
Ca chiều: 13:00–14:00, 14:00–15:00, ..., 18:00–19:00 (6 slots)
Tổng: 12 slots/ngày/HLV
```

---

## Data model

```sql
-- ClassSession: đã có, dùng type=PRIVATE_1_1/PRIVATE_1_2
-- capacity: 1 cho 1-1, 2 cho 1-2
-- gym_class_id = NULL cho buổi riêng

-- Waitlist (đã có từ UC5.1): dùng lại cho cơ chế ghép 1-2
-- Hoặc phân biệt bằng: class_session_id của session PRIVATE_1_2 chờ ghép

-- Không cần bảng mới
```

---

## Giao diện (Hình 69–71)

### `/member/private-booking` (Hình 69, 70)

**Kiểm tra gói:**
- Fetch `/me/packages`, lọc gói ACTIVE loại GOI_1_1 hoặc GOI_1_2
- Nếu không có → hiển thị E-2 (card thông báo, không hiện form)
- Nếu có → hiển thị form

**Banner deadline (E-1):**
- Nếu `deadlinePassed = true`: banner vàng "Đã hết hạn đăng ký cho tuần [X]. Đang hiển thị lịch tuần [Y]."

**Form chọn slot:**
- Tiêu đề: "Đăng ký buổi 1-1" hoặc "Đăng ký buổi 1-2" (theo loại gói)
- Dropdown/list chọn HLV → khi chọn HLV, hiển thị lịch ngày-giờ của HLV đó
- Lịch theo ngày (T2→CN) × khung giờ: slot available = nút teal; slot đã đặt = xám/disabled
- Khi click slot → mở confirm modal

**Confirm modal:**
- Chi tiết: HLV, ngày, giờ, gói sẽ dùng
- Gói 1-2: thêm section "Người đồng hành":
  - Radio "Mời hội viên cụ thể" → input email/SĐT của partner
  - Radio "Để hệ thống ghép" → chờ người khác chọn cùng slot
- Nút "Xác nhận đăng ký" teal + "Hủy" xám

**Slot hiển thị:**
```
[Thứ / dd-MM]  [06:00–07:00] [07:00–08:00] ... [18:00–19:00]
HLV A          [Trống]       [Đã đặt]      ...  [Trống]
HLV B          [Trống]       [Trống]       ...  [Đã đặt]
```
Hoặc dạng danh sách theo HLV với lịch ngày-giờ.

---

## Notes cho Backend Dev

1. **ClassSession đã có** — khi tạo private booking, tạo mới `ClassSession` (type=PRIVATE_*, gym_class_id=NULL, trainer_id, session_date, start_time, end_time, capacity=1/2)
2. **Transaction lock**: khi tạo ClassSession mới, dùng `@Transactional` + check lại slot trước khi INSERT để tránh race condition
3. **Gói 1-2 + ghép**: nếu `joinMatchmaking=true` → tìm ClassSession PRIVATE_1_2 chưa đủ người (bookedCount < 2) cùng trainerId+date+startTime → ghép vào đó; nếu không có → tạo mới
4. **Hủy buổi private (S-1)**: khi `DELETE /bookings/{id}` hủy booking của PRIVATE session → nếu ClassSession không còn booking nào (bookedCount=0) → xóa ClassSession (hard delete vì chưa diễn ra)
5. **Notification**: gửi thông báo cho cả hội viên VÀ HLV (dùng NotificationService.sendBookingConfirmation)
6. Lấy `member` từ `userId` trong SecurityContext như UC5.1

## Notes cho Frontend Dev

1. `/member/private-booking` đang là Placeholder trong App.tsx → thay bằng component thật
2. Sidebar MEMBER: "Buổi 1-1/1-2" đã có → `/member/private-booking`
3. Layout title: "Đăng ký buổi 1-1/1-2"
4. Fetch `/me/packages` để biết loại gói → render form phù hợp (1-1 hay 1-2)
5. Fetch `/private-booking/slots?week=...` → render slot grid
6. Không cần tuần navigation (chỉ show 1 tuần target) — nhưng hiển thị rõ tuần nào đang đăng ký

## Notes cho QA

- Verify E-2 khi không có gói 1-1/1-2 ACTIVE
- Verify deadline logic: tuần kế tiếp vs tuần+2
- Verify slot không show khung giờ đã có ClassSession của HLV đó
- Verify race condition (E-3): hai request cùng lúc → chỉ 1 người đặt được
- Verify gói 1-2 matchmaking: tìm session chưa đủ người → ghép
- Verify trừ buổi đúng (sessionsRemaining null → không trừ)
- Verify notification gửi cả hội viên lẫn HLV
