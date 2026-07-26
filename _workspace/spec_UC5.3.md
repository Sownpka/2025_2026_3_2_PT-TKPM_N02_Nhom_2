# Spec UC5.3 — Điểm danh buổi học

## Thông tin chung

- **UC ID:** UC5.3
- **Tên:** Điểm danh buổi học
- **Actor chính:** RECEPTIONIST (Lễ tân)
- **Route:** `/reception/attendance`
- **Màn hình tham chiếu:** Hình 65, 66, 67, 68
- **Dependency:** Cần dữ liệu từ UC5.1 (booking) và UC2.2 (member_package)

---

## Luồng cơ bản — Hình 65, 66, 67

1. Lễ tân vào `/reception/attendance`
2. Hệ thống hiển thị **"Điểm danh hôm nay"**: danh sách tất cả buổi học hôm nay (ngày hiện tại)
   - Mỗi buổi hiển thị: tên lớp (hoặc "Buổi 1-1/1-2"), HLV, giờ, **"x/y đã điểm danh"** (đã check-in / tổng đặt chỗ BOOKED)
3. Click vào một buổi → mở danh sách hội viên đã đặt (booking status=BOOKED hoặc đã xử lý)
   - Mỗi hàng: **Họ tên | Gói tập | Số buổi còn lại | Trạng thái điểm danh | Nút "Có mặt" (xanh) | Nút "No-show" (đỏ)**
   - Nếu booking status đã là ATTENDED → disable cả 2 nút (hoặc hiển thị pill xanh "Có mặt")
   - Nếu booking status đã là NO_SHOW → disable hoặc hiển thị pill đỏ "No-show"
4. Nhấn **"Có mặt"** → backend:
   - Cập nhật `booking.status = ATTENDED`, `booking.checked_in_at = now()`
   - **KHÔNG trừ buổi** (đã trừ khi đặt lịch UC5.1)
   - Trả về booking mới → frontend cập nhật hàng đó
5. Nhấn **"No-show"** → backend:
   - Cập nhật `booking.status = NO_SHOW`
   - **Không hoàn buổi** (theo business rule mục 5.2: no-show không hoàn)
   - Trả về booking mới → frontend cập nhật hàng đó
6. Số "x/y đã điểm danh" cập nhật realtime theo từng hành động

---

## Luồng thay thế

### E-1 — Điểm danh nhanh (walk-in) — Hình 68

- Nút **"Điểm danh nhanh"** trên trang chính (hoặc header panel)
- Nhấn → dialog nhập **SĐT**
- Hệ thống tìm hội viên theo SĐT → hiển thị họ tên + gói tập hiện tại (ACTIVE, loại + số buổi còn)
- Không tìm thấy → "Không tìm thấy hội viên với SĐT này"
- Hội viên không có gói ACTIVE → "Hội viên chưa có gói tập còn hiệu lực"
- Xác nhận → backend:
  - **Trừ 1 buổi** từ gói ACTIVE (walk-in chưa từng đặt lịch nên chưa bị trừ)
  - Tạo **booking mới** với status=ATTENDED, checked_in_at=now() — không cần classSessionId (walk-in không gắn với buổi cụ thể, ghi classSessionId=null hoặc tạo session ad-hoc)
  - Ghi lịch sử tập cho hội viên
- Toast: "Điểm danh thành công cho [Họ tên]"

### S-1 — Không có buổi học hôm nay

- Danh sách buổi rỗng → hiển thị "Không có buổi học nào hôm nay"

### S-2 — Buổi không có hội viên đặt

- Danh sách hội viên trong buổi rỗng → "Chưa có hội viên đăng ký cho buổi này"

---

## API Endpoints

```
GET /api/attendance/today
  - RECEPTIONIST only
  - Trả về danh sách buổi học trong ngày hôm nay (class_session.session_date = today)
  - Bao gồm cả GROUP và PRIVATE
  - Response: Array<{
      sessionId: number,
      className: string,        // tên lớp hoặc "Buổi 1-1" / "Buổi 1-2"
      trainerName: string,
      startTime: string,        // "HH:mm"
      endTime: string,
      capacity: number,
      bookedCount: number,      // tổng booking BOOKED + ATTENDED + NO_SHOW
      checkedInCount: number    // số booking ATTENDED
    }>

GET /api/attendance/{sessionId}/attendees
  - RECEPTIONIST only
  - Trả về danh sách hội viên đã đặt buổi {sessionId}
  - Response: Array<{
      bookingId: number,
      memberId: number,
      memberName: string,
      packageTypeName: string,  // tên loại gói, null nếu không có
      sessionsRemaining: number | null,
      bookingStatus: "BOOKED" | "ATTENDED" | "NO_SHOW" | "CANCELLED"
    }>

POST /api/attendance/{bookingId}/check-in
  - RECEPTIONIST only
  - Cập nhật booking.status = ATTENDED, checked_in_at = now()
  - 409 nếu đã ATTENDED hoặc NO_SHOW
  - Response: { bookingId, status, checkedInAt }

POST /api/attendance/{bookingId}/no-show
  - RECEPTIONIST only
  - Cập nhật booking.status = NO_SHOW
  - 409 nếu đã ATTENDED hoặc NO_SHOW
  - Response: { bookingId, status }

POST /api/attendance/quick-checkin
  - RECEPTIONIST only
  - Body: { phone: string }
  - Tìm hội viên theo SĐT → gói ACTIVE → trừ 1 buổi → tạo booking ATTENDED
  - 404: "Không tìm thấy hội viên với SĐT này"
  - 422: "Hội viên chưa có gói tập còn hiệu lực"
  - Response: { memberName, packageTypeName, sessionsRemaining }
```

---

## Data model

Dùng lại bảng hiện có:
- `class_session` — lấy theo session_date = today
- `booking` — status ENUM(BOOKED, CANCELLED, ATTENDED, NO_SHOW); field `checked_in_at`
- `member_package` — để hiển thị gói + số buổi
- `member` — họ tên

Không cần bảng mới. Quick check-in: tạo booking với classSessionId=null hoặc tạo 1 ClassSession "walk-in" ephemeral.

**Thiết kế quick-checkin booking:** Tạo booking với `class_session_id = null` (nullable đã có trong schema từ trường `gym_class_id`). Tuy nhiên booking.class_session_id FK có thể NOT NULL. Phương án an toàn hơn: **tạo ClassSession ad-hoc** với type=GROUP, date=today, không có trainer/gym_class → booking gắn vào đó.

> **Đề xuất:** Lưu quick-checkin booking với `class_session_id = null`. Nếu schema ràng buộc NOT NULL → thêm cột `is_walkin BOOLEAN DEFAULT false` vào `booking` hoặc dùng nullable classSessionId. Kiểm tra thực tế DDL hiện có.

---

## Business rules áp dụng

- BR 5.2: Đặt lịch trước → trừ ngay; hủy → hoàn; no-show → **không hoàn**; check-in "Có mặt" → **KHÔNG trừ lần 2**; walk-in → trừ tại check-in.
- BR 5.9: Soft delete mọi nơi — không xóa booking, chỉ đổi status.

---

## Giao diện (Hình 65–68)

### Trang chính `/reception/attendance` (Hình 65)

**Header:** "Điểm danh hôm nay" + ngày hiện tại (ví dụ: "Thứ Sáu, 18/07/2026") + nút **"Điểm danh nhanh"** (màu teal)

**Danh sách buổi học** (dạng card/bảng):
```
[Tên lớp] | [HLV] | [Giờ bắt đầu – kết thúc] | [x/y đã điểm danh] | Nút "Xem & điểm danh"
```
- Buổi đã kết thúc (endTime < now): có thể dim màu nhẹ nhưng vẫn cho điểm danh
- Sắp xếp theo startTime ASC

### Panel hội viên — Hình 66, 67

Click "Xem & điểm danh" → mở panel/modal bên phải hoặc inline expand:

| Họ tên | Gói tập | Còn lại | Trạng thái | Thao tác |
|--------|---------|---------|------------|---------|
| Nguyễn Văn A | Gói 12 buổi | 5 buổi | BOOKED | [Có mặt] [No-show] |
| Trần Thị B | Gói tháng | ∞ | ATTENDED | Đã điểm danh ✓ |

- Nút "Có mặt" màu xanh lá `#22C55E`; nút "No-show" màu đỏ `#EF4444`
- Sau khi nhấn → cập nhật hàng ngay (optimistic hoặc re-fetch); cập nhật counter "x/y"

### Dialog điểm danh nhanh — Hình 68

Modal nhỏ:
- Input: "Nhập số điện thoại hội viên"
- Sau khi tìm thấy: card thông tin (Họ tên + tên gói + số buổi còn)
- Nút "Xác nhận điểm danh" teal + "Hủy" xám

---

## Notes cho Backend Dev

1. Dùng `@PreAuthorize("hasRole('RECEPTIONIST')")` cho tất cả endpoint attendance
2. `GET /attendance/today`: query `class_session WHERE session_date = LocalDate.now()`, batch-load booking counts
3. Check-in/No-show: chỉ chuyển từ BOOKED → ATTENDED/NO_SHOW; nếu đã không còn BOOKED → 409
4. Quick-checkin: tìm `member.phone`, lấy gói ACTIVE, tạo booking với classSessionId=NULL (kiểm tra xem Booking entity có cho phép null không). Nếu FK strict → tạo ClassSession "walk-in" ephemeral trước.
5. Package trừ: với gói giới hạn buổi (sessionsRemaining != null) → `sessionsRemaining--` tại quick-checkin

## Notes cho Frontend Dev

1. Route `/reception/attendance` đang là Placeholder trong App.tsx → thay bằng AttendancePage
2. Sidebar RECEPTIONIST cần có "Điểm danh" → `/reception/attendance`
3. Fetch `/attendance/today` khi mount; mỗi khi click check-in/no-show → PATCH rồi update state local
4. Quick-checkin: debounce input SĐT 300ms → gọi preview endpoint (hoặc chỉ search khi nhấn nút)
5. Dùng useState + useEffect (no React Query)
6. Layout title: "Điểm danh hôm nay"
