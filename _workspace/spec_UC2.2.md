# Spec UC2.2 — Xem gói tập & lịch sử tập

## Thông tin chung

- **UC ID:** UC2.2
- **Tên:** Xem gói tập & lịch sử tập
- **Actor:** MEMBER (hội viên)
- **Route:** `/member/history`
- **Màn hình tham chiếu:** Hình 32, 33

## Luồng cơ bản

1. Hội viên đăng nhập vào hệ thống (UC1.1)
2. Vào menu "Gói tập & Lịch sử" → `/member/history`
3. **Khối trên** — danh sách gói tập của hội viên:
   - Tên gói, số buổi còn lại, ngày bắt đầu, ngày hết hạn, trạng thái
   - Gói sắp hết: badge/banner cảnh báo khi ≤ 2 buổi hoặc ≤ 7 ngày hết hạn (Business rule 10)
4. **Khối dưới** — lịch sử buổi tập:
   - Ngày, tên lớp học, huấn luyện viên, trạng thái (Đã tập / No-show)
   - Danh sách cuộn được

## Luồng phụ

- **S-1 Lọc theo thời gian:** dropdown "Tuần này / Tháng này / Tùy chọn (date range)" — áp dụng cho khối lịch sử bên dưới

## Luồng thay thế (Empty states)

- Chưa có gói → "Chưa đăng ký gói tập nào" + hướng dẫn "Vui lòng liên hệ lễ tân để đăng ký gói tập."
- Chưa có lịch sử → "Chưa có buổi tập nào được ghi nhận"

## Phân quyền

- **Chỉ MEMBER** được truy cập route này
- Backend **BẮT BUỘC** kiểm tra userId từ JWT — hội viên chỉ xem được dữ liệu của chính mình
- Không dùng memberId từ query param — lấy từ SecurityContext

## API Endpoints

```
GET /api/me/packages
  - Response: list of member packages của hội viên đang đăng nhập
  - Fields: id, packageTypeName, category, sessionsRemaining, startDate, endDate, status

GET /api/me/history?filter=WEEK|MONTH|CUSTOM&from=yyyy-MM-dd&to=yyyy-MM-dd
  - Response: list booking history của hội viên
  - Fields: sessionDate, className, trainerName, startTime, endTime, attendanceStatus (ATTENDED|NO_SHOW)
  - Filter mặc định: MONTH (tháng hiện tại)
```

## Data model liên quan

```sql
-- member_package: gói tập của hội viên
member_package(id, member_id FK, package_type_id FK, start_date, end_date, sessions_remaining, status ENUM(ACTIVE,EXPIRED,USED_UP))

-- package_type: thông tin loại gói
package_type(id, name, category, sessions, duration_days, price, description, status)

-- booking: lịch sử đặt chỗ
booking(id, class_session_id FK, member_id FK, member_package_id FK, status ENUM(BOOKED,CANCELLED,ATTENDED,NO_SHOW), booked_at, checked_in_at)

-- class_session: buổi học
class_session(id, gym_class_id FK NULL, trainer_id FK, session_date, start_time, end_time, type)

-- gym_class: lớp học
gym_class(id, name, trainer_id FK, ...)

-- trainer_profile → user_account (full_name)
trainer_profile(id, user_account_id FK, ...)
user_account(id, full_name, ...)
```

Join để lấy lịch sử:
```
booking → class_session → gym_class (tên lớp)
                        → trainer_profile → user_account (tên HLV)
booking.status IN (ATTENDED, NO_SHOW) → hiển thị lịch sử
```

## Business Rules

1. **Chỉ xem data của chính mình** — backend filter theo `member.user_account_id = currentUserId`
2. **Badge cảnh báo** khi gói:
   - `sessions_remaining <= 2` VÀ category là THEO_BUOI/GOI_1_1/GOI_1_2
   - HOẶC `end_date - today <= 7 ngày`
3. Lịch sử chỉ hiển thị booking status `ATTENDED` hoặc `NO_SHOW` (không hiển thị BOOKED/CANCELLED)
4. Sắp xếp lịch sử: `session_date DESC, start_time DESC`
5. Sắp xếp gói: ACTIVE trước, rồi theo `start_date DESC`

## Giao diện (Design System)

- Layout: Sidebar trái (menu MEMBER: Đặt lịch, Gói tập & Lịch sử, Đăng ký 1-1/1-2) + header trắng
- Sidebar background: teal đậm `#0F3D3E`–`#134E4A`
- Tên trang: "Gói tập & Lịch sử tập luyện"

### Khối gói tập
- Mỗi gói: card trắng, border, shadow nhẹ, bo góc `rounded-lg`
- Status pill: ACTIVE = xanh lá nhạt, EXPIRED = xám, USED_UP = đỏ nhạt
- Cảnh báo sắp hết: badge cam hoặc banner vàng nhạt trên card
- Label: "Còn lại", "Bắt đầu", "Hết hạn", "Trạng thái"

### Khối lịch sử
- Bảng hoặc list item với cột: Ngày | Lớp học | Huấn luyện viên | Giờ | Trạng thái
- Status pill: "Đã tập" = xanh lá nhạt; "No-show" = đỏ nhạt
- Filter bar trên bảng: dropdown chọn "Tuần này / Tháng này / Tùy chọn"
- Khi chọn "Tùy chọn": hiển thị 2 date picker (từ ngày — đến ngày)

## Package path trong project

- Backend: `com.picore.me` hoặc thêm endpoint vào module tương ứng
- Frontend: `frontend/src/pages/member/MemberHistoryPage.tsx`
- Store: `frontend/src/stores/member.ts` (hoặc thêm vào existing store)
- API client: `frontend/src/api/member.ts`

## Notes cho Backend Dev

- Endpoint `/api/me/*` dùng `@GetMapping` trong controller riêng `MeController`
- Lấy `currentUserId` từ `SecurityContextHolder.getContext().getAuthentication().getPrincipal()`
- Tìm member từ `member.user_account_id = currentUserId` → lấy `member.id` → query
- Cần JOIN nhiều bảng để lấy lịch sử → viết JPQL hoặc native query
- Trả về DTO (record) — không expose entity trực tiếp

## Notes cho Frontend Dev

- Route cần `ProtectedRoute` với `allowedRoles={['MEMBER']}`
- Dùng React Query để fetch `/api/me/packages` và `/api/me/history`
- State cho filter (WEEK/MONTH/CUSTOM) dùng local `useState`, truyền vào query params
- Date picker cho CUSTOM filter: dùng input type="date" của HTML5 (không cần thư viện ngoài)
- Khi packages đang loading: skeleton loader
- Import màu từ design system đã có (teal, cam, xanh lá...)
