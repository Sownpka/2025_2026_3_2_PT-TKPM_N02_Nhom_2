# Spec UC5.1 — Đặt & hủy lịch tập

## Thông tin chung

- **UC ID:** UC5.1
- **Tên:** Đặt & hủy lịch tập
- **Actor chính:** MEMBER (hội viên); Actor phụ: RECEPTIONIST (đặt hộ)
- **Routes:**
  - `/member/booking` — thời khóa biểu tuần + đặt chỗ (MEMBER)
  - `/member/my-bookings` — danh sách lịch tập của tôi + hủy (MEMBER)
- **Màn hình tham chiếu:** Hình 58–64

---

## Luồng cơ bản — Đặt chỗ

1. Hội viên vào `/member/booking` → xem thời khóa biểu tuần (lưới T2→CN)
2. Mỗi card lớp hiển thị: **tên lớp, HLV, giờ, số chỗ còn lại** + nút **"Đặt chỗ"** (teal)
3. Lớp đầy → nút xám **"Hết chỗ"** / **"Đã đầy"**
4. Nhấn "Đặt chỗ" → màn hình xác nhận (Hình 59): chi tiết buổi + gói sẽ bị trừ buổi
5. Xác nhận → backend kiểm tra theo thứ tự:
   - **(a)** lớp còn chỗ
   - **(b)** hội viên có gói hiệu lực (status = ACTIVE, endDate >= today, sessionsRemaining > 0 nếu có)
   - **(c)** chưa đặt buổi này (chưa có booking BOOKED/ATTENDED cho session đó)
6. Tạo `booking` (status=BOOKED) + **trừ 1 buổi** (`sessionsRemaining -= 1`) trong **1 transaction**
7. Kích hoạt UC5.4 (thông báo xác nhận) — gọi async, không block
8. Toast thành công

---

## Luồng phụ S-1 — Hủy lịch

- Trang `/member/my-bookings` (hoặc tab "Lịch tập của tôi") — danh sách theo trạng thái:
  - **Sắp diễn ra** (BOOKED, sessionDate >= today)
  - **Đã hoàn thành** (ATTENDED)
  - **Đã hủy** (CANCELLED)
- Nút "Hủy" chỉ xuất hiện ở tab "Sắp diễn ra"
- Nhấn "Hủy" → dialog xác nhận → `DELETE /bookings/{id}`:
  - Đổi booking status = CANCELLED
  - **Hoàn trả 1 buổi** (`sessionsRemaining += 1`)
  - Mở chỗ cho waitlist: nếu có người đầu waitlist → notify họ (UC5.4 async)
- Toast thành công

---

## Luồng thay thế

### E-1 — Lớp đầy (Hình 60)
- Dialog: "Lớp học đã đầy. Bạn có muốn vào danh sách chờ không?"
- Nút "Vào danh sách chờ" → `POST /waitlist` → thêm vào waitlist (FIFO)
- Nút "Không, cảm ơn" → đóng dialog
- Khi có người hủy → backend tự notify người đầu waitlist (UC5.4)

### E-2 — Không có gói hiệu lực (Hình 61)
- Thông báo: **"Bạn chưa có gói tập còn hiệu lực. Vui lòng liên hệ lễ tân để đăng ký gói tập."**
- Không tạo booking

### E-3 — Đã đặt buổi này (Hình 62)
- Thông báo: **"Bạn đã đặt lịch cho buổi học này."** + link tới "Lịch tập của tôi"

---

## API Endpoints

```
GET  /api/timetable?week=YYYY-Www
  - Tất cả vai trò có thể xem (MEMBER xem để đặt lịch)
  - Trả về sessions của tuần đó kèm booking count + capacity
  - MEMBER: mỗi session có thêm field `myBookingStatus` (null | 'BOOKED' | 'CANCELLED' | 'ATTENDED')
  - Đã có từ UC4.1 — kiểm tra xem đã implement chưa, nếu thiếu field thì bổ sung

POST /api/bookings
  Body: { classSessionId: number, memberPackageId: number }
  - MEMBER only (hoặc RECEPTIONIST với thêm memberId)
  - Transaction + lock: SELECT ... FOR UPDATE hoặc optimistic locking
  - Kiểm tra (a)(b)(c) trong transaction
  - Trả về booking id + status

DELETE /api/bookings/{id}
  - MEMBER only (chỉ hủy booking của chính mình)
  - Hoàn trả buổi + notify waitlist

POST /api/waitlist
  Body: { classSessionId: number }
  - MEMBER only

GET  /api/me/bookings?status=UPCOMING|COMPLETED|CANCELLED
  - MEMBER only
  - UPCOMING = BOOKED + sessionDate >= today (sắp xếp sessionDate ASC)
  - COMPLETED = ATTENDED (sắp xếp sessionDate DESC)
  - CANCELLED = CANCELLED (sắp xếp cancelledAt DESC)
```

---

## Data model

```sql
-- Bảng booking: đã có entity stub từ UC2.2
booking(id, class_session_id FK, member_id FK, member_package_id FK,
        status ENUM(BOOKED,CANCELLED,ATTENDED,NO_SHOW),
        booked_at, cancelled_at, checked_in_at)

-- Bảng waitlist: chưa có entity
waitlist(id, class_session_id FK, member_id FK, created_at, notified BOOL)

-- class_session: đã có, có field capacity
-- member_package: có sessionsRemaining (nullable = vô hạn)
```

---

## Business Rules (từ CLAUDE.md mục 5)

1. **Transaction + lock:** kiểm tra capacity và trừ buổi trong **1 transaction**. Dùng `@Transactional` + `SELECT ... FOR UPDATE` hoặc optimistic lock trên `member_package.sessions_remaining`.
2. **Sức chứa = capacity của class_session**, không vượt quá.
3. **Quy tắc trừ buổi:**
   - Đặt lịch thành công → trừ 1 buổi ngay (KHÔNG chờ điểm danh)
   - Hủy lịch hợp lệ → hoàn 1 buổi
   - sessionsRemaining = null → vô hạn (không trừ/hoàn)
4. **No-show:** buổi đã trừ khi đặt, không hoàn lại khi no-show
5. **Waitlist FIFO:** notify người đầu hàng khi có chỗ trống

---

## Phân quyền

- `GET /timetable` — tất cả authenticated (bổ sung field `myBookingStatus` cho MEMBER)
- `POST /bookings` — MEMBER (đặt chỗ mình) hoặc RECEPTIONIST (đặt hộ — thêm field `memberId`)
- `DELETE /bookings/{id}` — MEMBER (chỉ booking của chính mình) hoặc RECEPTIONIST
- `POST /waitlist` — MEMBER
- `GET /me/bookings` — MEMBER

---

## Giao diện (Hình 58–64)

### `/member/booking` — Thời khóa biểu tuần (Hình 58)
- Lưới 7 cột T2→CN, header = ngày (dd/MM)
- Mỗi card lớp trong ô: tên lớp, HLV, giờ bắt đầu–kết thúc, số chỗ còn lại
- Nút "Đặt chỗ" teal (chỗ còn) / "Hết chỗ" xám (đầy) / "Đã đặt" xanh outline (đã có booking)
- Nút điều hướng ← → tuần trước/sau; label "Tuần dd/MM – dd/MM"
- Khối phụ bên phải/dưới: "Gói tập của tôi" — số buổi còn lại

### Màn hình xác nhận đặt chỗ (Hình 59)
- Modal hoặc trang riêng: chi tiết buổi học (tên lớp, ngày, giờ, HLV, phòng/thiết bị)
- "Gói sẽ được trừ: [tên gói] — còn X buổi → còn X-1 buổi sau đặt"
- Nút "Xác nhận đặt chỗ" teal + "Hủy" xám

### E-1 dialog waitlist (Hình 60)
- Modal: "Lớp học đã đầy. Bạn có muốn vào danh sách chờ không?"
- Nút "Vào danh sách chờ" teal + "Không, cảm ơn" xám

### E-2 dialog không có gói (Hình 61)
- Banner/modal: "Bạn chưa có gói tập còn hiệu lực. Vui lòng liên hệ lễ tân để đăng ký gói tập."

### E-3 đã đặt (Hình 62)
- Toast hoặc modal: "Bạn đã đặt lịch cho buổi học này." + link "Xem lịch tập"

### `/member/my-bookings` — Lịch tập của tôi (Hình 63, 64)
- 3 tab: Sắp diễn ra | Đã hoàn thành | Đã hủy
- Mỗi item: tên lớp, HLV, ngày, giờ, trạng thái
- Tab "Sắp diễn ra": nút "Hủy" đỏ mỗi hàng
- Dialog xác nhận hủy: "Bạn có chắc muốn hủy lịch tập này không? 1 buổi sẽ được hoàn trả."

---

## Notes cho Backend Dev

1. **Booking entity stub đã có** từ UC2.2 — dùng lại, KHÔNG tạo mới.
2. **Waitlist entity cần tạo mới** — class + repository.
3. **Timetable endpoint** (`GET /timetable`) đã có ở `GymClassController` — kiểm tra xem có field `bookedCount`, `capacity`, `myBookingStatus` không; nếu thiếu thì bổ sung.
4. **Transaction lock:** dùng `@Lock(LockModeType.PESSIMISTIC_WRITE)` trên query `MemberPackageRepository.findById` hoặc native `SELECT ... FOR UPDATE`. Tránh race condition khi nhiều người đặt cùng lúc.
5. **BookingService:** inject BookingRepository, MemberPackageRepository, WaitlistRepository, ClassSessionRepository, MemberRepository, NotificationService.
6. Lấy current member từ `SecurityContext` → `findByUserAccountId`.

## Notes cho Frontend Dev

1. **Route mới cần thêm vào App.tsx:** `/member/my-bookings`
2. **Sidebar MEMBER** đã có "Đặt lịch" → `/member/booking`; cần thêm "Lịch tập của tôi" → `/member/my-bookings`
3. Timetable component từ AdminClassesPage có thể tham khảo logic tuần (weekStart, weekEnd, chuyển tuần)
4. Fetch timetable: `GET /api/timetable?week=YYYY-Www`
5. Format tuần ISO: `2026-W30` — dùng `date-fns` nếu có, nếu không tự tính (startOfISOWeek)
6. Confirm dialog: dùng state local (isConfirmOpen) + modal overlay

## Notes cho QA

- Verify booking không thể duplicate (E-3) — check backend unique constraint hoặc check trước insert
- Verify sessionsRemaining = null → không bị trừ/hoàn
- Verify chỉ MEMBER mới hủy được booking của chính mình (không hủy được booking của người khác)
- Verify waitlist FIFO (created_at ASC)
