# UC5.1 — Đặt & hủy lịch tập (Frontend) — DONE

## Files đã tạo mới

- `src/api/bookings.ts` — API module: `fetchTimetable`, `createBooking`, `cancelBooking`, `joinWaitlist`, `fetchMyBookings` + types (`MyBookingItem`, `MyBookingFilter`, `MyBookingStatus`, `CreateBookingRequest`, `BookingResponse`).
- `src/pages/member/MemberBookingPage.tsx` — Route `/member/booking`: lưới thời khóa biểu 7 cột (T2–CN) + chuyển tuần ISO, khối "Gói tập của tôi", flow đặt chỗ + modal xác nhận + dialog waitlist E-1.
- `src/pages/member/MyBookingsPage.tsx` — Route `/member/my-bookings`: 3 tab (Sắp diễn ra / Đã hoàn thành / Đã hủy) + flow hủy lịch + empty states.

## Files đã sửa

- `src/App.tsx` — import 2 page mới; thay Placeholder `/member/booking` → `<MemberBookingPage />`; thêm route `/member/my-bookings` → `<MyBookingsPage />`.
- `src/components/Sidebar.tsx` — thêm item MEMBER `{ label: 'Lịch tập của tôi', path: '/member/my-bookings' }`.
- `src/components/Layout.tsx` — title `/member/booking` = "Đặt lịch tập"; thêm title `/member/my-bookings` = "Lịch tập của tôi".
- `src/types/class.ts` — thêm `myBookingStatus?: string | null` vào `TimetableSession`; `gymClassId` → `number | null`.

## Ghi chú kỹ thuật quan trọng

- **Reconcile spec vs backend thật**: Task prompt mô tả response có `weekLabel` và `dayOfWeek: "MONDAY"`. Backend thật (đã kiểm chứng tại `backend/.../TimetableResponse.java`, `TimetableSession.java`, `GymClassService.java:226`) trả về:
  - `week` (string `"YYYY-Www"`, KHÔNG phải `weekLabel`) → mình tự dựng label tuần bằng helper ISO ở frontend.
  - `dayOfWeek` = `"MON".."SUN"` (substring 3 ký tự), KHÔNG phải `"MONDAY"`.
  - `myBookingStatus` xác nhận có thật, chỉ MEMBER mới nhận (ADMIN/RECEPTIONIST → null).
  Frontend build theo backend thật, khớp với type `TimetableSession` sẵn có.
- **Timetable dùng chung endpoint** `/api/timetable` (đã cho MEMBER trong `@PreAuthorize`). Không reinvent — copy bộ helper ISO week từ pattern của `AdminClassesPage` (KHÔNG import từ admin).
- **Nút hành động card** theo `myBookingStatus`: `ATTENDED` → "Đã tập" (xanh lá); `BOOKED` → pill "Đã đặt" (xanh dương); quá khứ (`sessionDate < today`) → disabled "Đã qua"; hết chỗ → "Hết chỗ" (xám, mở waitlist); còn chỗ → "Đặt chỗ" (teal). `CANCELLED`/`NO_SHOW` coi như chưa đặt (được đặt lại).
- **Chọn gói khi đặt**: fetch `/me/packages`, lọc `status === 'ACTIVE'`. 1 gói → tự chọn; nhiều gói → dropdown; 0 gói → thông báo E-2, disable nút xác nhận. Gói vô hạn (`sessionsRemaining === null` hoặc category không theo buổi) → "Gói không giới hạn số buổi"; gói theo buổi → "Sau khi đặt: còn X-1 buổi".
- **Xử lý lỗi POST /bookings**: `409 + message chứa "đầy"` → đóng confirm, mở dialog waitlist E-1; các lỗi khác (409 "đã đặt", 422 "chưa có gói", ...) → toast + refresh timetable. Phân biệt bằng `err.response.status` + nội dung message qua `parseApiError`.
- **Hủy lịch**: chỉ tab "Sắp diễn ra" có nút "Hủy" (đỏ) → dialog xác nhận → `DELETE /bookings/{id}` → toast "Hủy lịch thành công, 1 buổi đã được hoàn trả" → refresh.

## Kiểm tra

- `npx tsc --noEmit` trong `frontend/` → PASS (không lỗi).
- Không cài thêm package. Dùng `useState`+`useEffect`, axios client sẵn có, TailwindCSS, design system teal/pill theo spec.
