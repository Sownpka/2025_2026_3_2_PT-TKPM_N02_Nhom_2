# QA Report — UC5.1 (Đặt & hủy lịch tập)

- **Ngày kiểm tra:** 2026-07-18
- **Người kiểm tra:** qa-verifier
- **Phạm vi:** Tích hợp backend ↔ frontend cho UC5.1 tại `D:\Pi-core\`
- **Kết quả tổng thể:** **PASS** (không có lỗi CRITICAL)

## Tóm tắt số lượng issue

| Mức độ  | Số lượng |
|---------|----------|
| CRITICAL | 0 |
| WARNING  | 2 |
| INFO     | 4 |

---

## 1. Shape alignment (API ↔ TypeScript) — PASS

| DTO Java | Type TS | Kết quả |
|----------|---------|---------|
| `BookingResponse(id, classSessionId, status, bookedAt)` | `bookings.ts BookingResponse` | Khớp hoàn toàn |
| `MyBookingItem(bookingId, className, trainerName, sessionDate, startTime, endTime, bookingStatus, bookedAt, cancelledAt)` | `bookings.ts MyBookingItem` | Khớp; `cancelledAt` nullable đúng (`string \| null`) |
| `TimetableSession(... capacity, bookedCount, availableSpots, myBookingStatus)` | `types/class.ts TimetableSession` | Khớp; `myBookingStatus?: string \| null` |
| `TimetableResponse(week, sessions)` | `types/class.ts TimetableResponse` | Khớp (`week`, không phải `weekLabel`) |

- Kiểu ngày/giờ: `LocalDate`/`LocalTime`/`LocalDateTime` → `string` — nhất quán với phần còn lại của codebase.
- `dayOfWeek` backend tạo bằng `getDayOfWeek().name().substring(0,3)` → "MON".."SUN", khớp union `DayOfWeek` phía TS.

## 2. Security & authorization — PASS

| Endpoint | Yêu cầu spec | Thực tế | Kết quả |
|----------|--------------|---------|---------|
| `POST /bookings` | MEMBER hoặc RECEPTIONIST | `@PreAuthorize("hasAnyRole('MEMBER','RECEPTIONIST')")` | PASS |
| `DELETE /bookings/{id}` | MEMBER chỉ hủy của mình | `cancelBooking` → `cancelInternal(verifyOwnership=true)` check `booking.memberId == owner` → 403 nếu sai; RECEPTIONIST bỏ qua ownership | PASS |
| `POST /waitlist` | MEMBER only | `@PreAuthorize("hasRole('MEMBER')")` | PASS |
| `GET /me/bookings` | MEMBER only | `MeController` class-level `@PreAuthorize("hasRole('MEMBER')")` | PASS |
| `GET /timetable` | Cho phép MEMBER | `hasAnyRole('ADMIN','RECEPTIONIST','MEMBER')`; `myBookingStatus` chỉ tính cho MEMBER | PASS |

RECEPTIONIST đặt hộ bắt buộc `memberId` (400 nếu thiếu) — đúng.

## 3. Transaction & business rules — PASS

- `bookSession`/`doBook` có `@Transactional`; khóa bi quan qua `ClassSessionRepository.findByIdForUpdate` (`@Lock(PESSIMISTIC_WRITE)`). PASS.
- Thứ tự kiểm tra: (a) capacity → (b) gói hiệu lực → (c) duplicate — đúng thứ tự spec mục 5.
- `requireUsablePackage`: kiểm tra ownership gói + `status=ACTIVE` + `endDate >= today` + (`sessionsRemaining == null || > 0`). PASS.
- Trừ buổi: chỉ khi `sessionsRemaining != null` (null = vô hạn, không trừ). PASS.
- Hủy: `cancelInternal` đổi `CANCELLED`, hoàn buổi nếu `sessionsRemaining != null`, rồi `notifyWaitlistHead`. PASS.
- Waitlist FIFO: `findFirstByClassSessionIdAndNotifiedFalseOrderByCreatedAtAsc`. PASS.
- Thông báo async không làm hỏng transaction (`notifyQuietly` nuốt RuntimeException). PASS.

## 4. Frontend flow — PASS (1 WARNING)

- `BookingCard`: "Đặt chỗ" (teal) khi còn chỗ & chưa đặt; "Hết chỗ" (xám) khi đầy → mở dialog waitlist; "Đã đặt"/"Đã tập" pill; "Đã qua" khi past. PASS.
- Modal xác nhận trước khi đặt (Hình 59) — có chi tiết buổi + chọn gói + dòng "Sau khi đặt: còn X buổi". PASS.
- Error 409 chứa "đầy" → chuyển sang dialog waitlist (E-1). PASS.
- Error 422 "chưa có gói" → toast (ErrorResponse.message surface đúng qua `parseApiError`). PASS.
- Error 409 "đã đặt" → toast (nhánh else). PASS.
- Dialog hủy có confirm trước `DELETE`. PASS.
- 3 tab UPCOMING/COMPLETED/CANCELLED filter đúng; empty states tiếng Việt. PASS.
- **WARNING-1:** Luồng E-3 (Hình 62) spec yêu cầu kèm link "Lịch tập của tôi"/"Xem lịch tập"; frontend chỉ hiển thị toast, không có link điều hướng.

## 5. Routes & navigation — PASS

- `/member/booking` → `MemberBookingPage` (đã thay Placeholder). PASS.
- `/member/my-bookings` → `MyBookingsPage` (route mới trong `App.tsx`). PASS.
- Sidebar MEMBER có "Lịch tập của tôi" → `/member/my-bookings`. PASS.
- `Layout.PAGE_TITLES` có cả `/member/booking` ("Đặt lịch tập") và `/member/my-bookings` ("Lịch tập của tôi"). PASS.

## 6. Labels tiếng Việt — PASS (1 INFO)

- "Đặt chỗ", "Hết chỗ", "Đã đặt", "Đã tập" — đúng.
- Waitlist dialog: chứa nguyên văn "Lớp học đã đầy. Bạn có muốn vào danh sách chờ không?" (+ câu bổ sung). PASS.
- Modal E-2 chứa nguyên văn "Bạn chưa có gói tập còn hiệu lực. Vui lòng liên hệ lễ tân để đăng ký gói tập." PASS.
- Dialog hủy: "Bạn có chắc muốn hủy lịch tập này không? 1 buổi sẽ được hoàn trả." — khớp nguyên văn. PASS.
- **INFO-1:** Không nhất quán nhỏ giữa các nơi: backend 422 trả `"Bạn chưa có gói tập còn hiệu lực"` (thiếu câu 2); khối tóm tắt sidebar dùng `"...để đăng ký."` thay vì `"...để đăng ký gói tập."`. Bản đầy đủ nguyên văn đã có ở modal xác nhận nên không chặn luồng.

## 7. Edge cases — PASS

- Gói `sessionsRemaining = null`: backend không trừ/hoàn; frontend hiển thị "Không giới hạn buổi" (tóm tắt) và "Gói không giới hạn số buổi" (modal). PASS.
- Timetable tuần hiện tại load khi mở trang (`loadTimetable()` không tham số → backend dùng tuần hiện tại). PASS.
- Nút chuyển tuần ← → hoạt động (`shiftWeek` ISO week, không cần thư viện). PASS.

---

## Danh sách issue

### WARNING

- **WARNING-1 — Thiếu link ở E-3 (đã đặt).** Spec (Hình 62) yêu cầu toast/modal "Bạn đã đặt lịch cho buổi học này." kèm link tới "Lịch tập của tôi". Hiện `MemberBookingPage.handleConfirmBooking` chỉ `showToast(message,'error')`. Đề xuất thêm link/nút điều hướng `/member/my-bookings`.

- **WARNING-2 — DELETE /bookings/{id} không chặn hủy buổi đã qua.** `cancelInternal` chỉ kiểm tra `status == BOOKED`, không kiểm tra `sessionDate >= today`. Một booking BOOKED của buổi đã qua (chưa được điểm danh) vẫn có thể bị hủy qua API trực tiếp và được hoàn 1 buổi. Frontend đã ẩn ở tab UPCOMING (đã lọc `sessionDate < today`), nên rủi ro thấp; nên thêm guard ngày ở service để phòng thủ chiều sâu.

### INFO

- **INFO-1 — Không nhất quán chuỗi thông báo E-2** (xem mục 6). Backend message ngắn hơn spec; sidebar rút gọn "để đăng ký.".
- **INFO-2 — Message E-3 backend thiếu dấu chấm cuối** (`"Bạn đã đặt lịch cho buổi học này"` vs spec `"...này."`). Cosmetic.
- **INFO-3 — Nút "Đặt chỗ" cũng hiện khi `myBookingStatus` = CANCELLED/NO_SHOW.** Spec ghi literal "chỉ khi null", nhưng đây là hành vi đúng (cho đặt lại sau khi hủy); `preferActiveStatus` đảm bảo BOOKED/ATTENDED thắng nên không hiển thị nhầm. Không phải lỗi.
- **INFO-4 — Kiểu TS `trainerName: string` (không nullable)** ở `MyBookingItem`/`TimetableSession`, nhưng backend có thể trả `null` (khi không có HLV). Chỉ ảnh hưởng độ chặt của type, không gây lỗi runtime hiện tại.

---

## Kết luận

UC5.1 tích hợp backend ↔ frontend **đạt yêu cầu (PASS)**. Shape khớp, phân quyền đầy đủ, transaction + pessimistic lock + quy tắc trừ/hoàn buổi + waitlist FIFO đều đúng spec. Không có lỗi CRITICAL. Hai WARNING (link E-3, guard ngày khi hủy) và bốn INFO là các cải thiện nhỏ, không chặn phát hành.
