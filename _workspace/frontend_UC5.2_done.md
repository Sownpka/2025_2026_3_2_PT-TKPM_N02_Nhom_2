# Frontend UC5.2 — Đăng ký buổi 1-1/1-2 — DONE

## Kết quả
`npx tsc --noEmit` PASS (không lỗi).

## Files

### Tạo mới
- `src/api/privateBooking.ts`
  - Interfaces: `SlotEntry`, `PrivateSlotsResponse`, `CreatePrivateBookingRequest`
  - `fetchPrivateSlots(week?)` → GET `/private-booking/slots`
  - `createPrivateBooking(req)` → POST `/private-booking` (trả `BookingResponse` reuse từ `bookings.ts`)
  - Dùng lại `DayOfWeek` từ `types/trainer.ts`, endpoint `PRIVATE_BOOKING` đã có sẵn trong `endpoints.ts`.

- `src/pages/member/PrivateBookingPage.tsx` — toàn bộ page.

### Sửa
- `src/App.tsx` — thay Placeholder `/member/private-booking` → `<PrivateBookingPage />` (thêm import).
- `src/components/Layout.tsx` — title `/member/private-booking` = "Đăng ký buổi 1-1/1-2".

## Logic đã implement

### Bước 1 — kiểm tra gói
- Fetch `/me/packages`, lọc `status==='ACTIVE'` và `category ∈ {GOI_1_1, GOI_1_2}`.
- E-2: không có gói → card cảnh báo vàng "Bạn chưa có gói 1-1/1-2 còn hiệu lực...", KHÔNG hiển thị form.
- Có gói → mới fetch slots.

### Bước 2 — hiển thị
- Banner vàng khi `deadlinePassed===true`, có label tuần targetWeek.
- Tên trang + label "Tuần dd/MM – dd/MM" tính từ `targetWeek` (ISO week helpers, không thêm package).
- Chọn HLV bằng tab list (unique trainer từ slots), auto chọn HLV đầu tiên.
- Grid: hàng = ngày (T2→CN, có dd/MM), cột = khung giờ (startTime unique, sorted).
  - Cell `available=true` → nút teal "Trống"; `available=false` → nút xám disabled "Đã đặt"; không có slot → "–".
  - `overflow-x-auto` cho mobile; cột "Ngày" sticky trái.

### Modal xác nhận
- Chi tiết: HLV, Ngày (dd/MM/yyyy — thứ), Giờ (HH:mm – HH:mm).
- Gói sử dụng: 1 gói → hiển thị cố định; nhiều gói → dropdown (mặc định ưu tiên gói `sessionsRemaining` cao nhất). Nhãn "Còn N buổi" hoặc "Không giới hạn".
- Chỉ gói GOI_1_2: section "Người đồng hành" — radio "Mời hội viên cụ thể" (input text email/SĐT) / "Để hệ thống ghép" (mặc định). `joinMatchmaking` = true khi chọn ghép.

### POST + lỗi
- Thành công → toast "Đặt lịch 1-1/1-2 thành công!" + refresh slots & packages.
- 409 → đóng modal + toast lỗi + refresh grid.
- 400/422/khác → toast lỗi (giữ modal).

## Lưu ý / hạn chế đã ghi rõ trong code
- "Mời hội viên cụ thể": backend CHƯA resolve email/SĐT → memberId. Phiên bản này gửi
  `partnerMemberId = null` (có comment NOTE trong code + hint UI màu amber). Backend sẽ bổ sung tra cứu sau.
- Sidebar "Buổi 1-1/1-2" đã có sẵn — không sửa.
- Không thêm package mới; dùng useState + useEffect.
