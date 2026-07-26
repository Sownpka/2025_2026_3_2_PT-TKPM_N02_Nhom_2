# QA Report — UC5.3 Điểm danh buổi học

## Kết quả: PASS

Không có lỗi ERROR. 2 WARNING nhỏ (không block, nên sửa).

## API Shape: OK

Kiểm tra từng DTO backend (record) ↔ TypeScript interface (`attendance.ts`):

| DTO | Backend | Frontend | Kết quả |
|-----|---------|----------|---------|
| `SessionSummary` | sessionId, className, trainerName, startTime, endTime, capacity, bookedCount, checkedInCount | khớp | OK (xem WARNING-2) |
| `AttendeeItem` | bookingId, memberId, memberName, packageTypeName, sessionsRemaining, bookingStatus | khớp | OK |
| `CheckInResponse` | bookingId, status, checkedInAt | khớp | OK |
| `QuickCheckinResponse` | memberName, packageTypeName, sessionsRemaining | khớp | OK |

- `startTime/endTime` backend format sẵn `"HH:mm"` (string), FE khai báo string — khớp.
- `packageTypeName`/`sessionsRemaining` nullable ở cả 2 phía — khớp.
- `checkedInAt` null cho no-show — khớp (FE `string | null`).
- `bookingStatus` backend chỉ trả BOOKED/ATTENDED/NO_SHOW (CANCELLED bị lọc); FE type có thêm CANCELLED — không sao.

## Endpoints: OK

Controller `@RequestMapping("/attendance")` + context-path `/api` → base `/api/attendance`. Khớp 100% với `endpoints.ts`:
- `GET /attendance/today` = `ATTENDANCE.TODAY`
- `GET /attendance/{sessionId}/attendees` = `ATTENDANCE.ATTENDEES(id)`
- `POST /attendance/{bookingId}/check-in` = `ATTENDANCE.CHECK_IN(id)`
- `POST /attendance/{bookingId}/no-show` = `ATTENDANCE.NO_SHOW(id)`
- `POST /attendance/quick-checkin` = `ATTENDANCE.QUICK_CHECKIN`

POST check-in/no-show gọi không body — khớp controller (chỉ `@PathVariable`).

## Business Rules: OK

- **BR-1 (check-in chỉ BOOKED→ATTENDED, else 409)**: OK. `checkIn()` → `requireBookedBooking()` (AttendanceService.java:235–242) ném 409 "Hội viên này đã được xử lý điểm danh" nếu status != BOOKED.
- **BR-2 (no-show không hoàn buổi)**: OK. `markNoShow()` (AttendanceService.java:187–193) chỉ `setStatus(NO_SHOW)` + save. Không có `setSessionsRemaining(+1)` trong toàn bộ path no-show. Xác nhận không hoàn buổi.
- **BR-3 (quick-checkin trừ 1 buổi)**: OK. `quickCheckin()` (AttendanceService.java:214–217) `setSessionsRemaining(getSessionsRemaining() - 1)` chỉ với gói giới hạn (`!= null`). Response trả số sau khi trừ.
- **BR-4 (check-in thường KHÔNG trừ buổi)**: OK. `checkIn()` (AttendanceService.java:176–182) chỉ đổi status + `checkedInAt`. Không đụng `sessionsRemaining`.

Xác nhận thêm: chọn gói ACTIVE walk-in (findUsableActivePackage) lọc `ACTIVE && endDate>=today && (sessionsRemaining==null || >0)`, ưu tiên start_date mới nhất — tránh trúng gói hết buổi. Tốt.

## Security: OK

- `AttendanceController` có `@PreAuthorize("hasRole('RECEPTIONIST')")` ở **class-level** (bao mọi endpoint).
- Method security được bật toàn cục: `@EnableMethodSecurity` tại `SecurityConfig.java:22` → `@PreAuthorize` có hiệu lực thật (không phải no-op).
- FE route `/reception/attendance` nằm trong `<ProtectedRoute allowedRoles={['RECEPTIONIST']}>` (App.tsx:75–83). `ProtectedRoute` redirect nếu role không khớp.

## Routing: OK

- App.tsx:82 — `/reception/attendance` render `<AttendancePage />` (đã bỏ Placeholder). Import đúng (App.tsx:14).
- Sidebar.tsx:26 — RECEPTIONIST có `{ label: 'Điểm danh', path: '/reception/attendance' }`.
- Layout.tsx:16 — có map title cho `/reception/attendance` (xem WARNING-1 về nội dung).

## UX/Labels: OK

- Nút "Có mặt" `bg-[#22C55E]` (xanh), "No-show" `bg-[#EF4444]` (đỏ) — đúng mã màu spec (AttendancePage.tsx:304, 311).
- Counter "x/y đã điểm danh": `{checkedInCount}/{bookedCount} đã điểm danh` (dòng 230, 254) — đúng format.
- Empty "Không có buổi học nào hôm nay" (dòng 206) — đúng.
- Empty "Chưa có hội viên đăng ký cho buổi này" (dòng 331) — đúng.
- Empty phụ "Chọn một buổi học để xem danh sách hội viên" (dòng 242) — hợp lý.
- `sessionsRemaining === null` → `'∞'` (dòng 287–289) — không crash.
- `packageTypeName ?? '—'` (dòng 284) — không crash.
- Quick-checkin 404 "Không tìm thấy hội viên với SĐT này" + 422 "Hội viên chưa có gói tập còn hiệu lực": message do backend trả, FE hiển thị qua `parseApiError` trong dialog. Khớp nguyên văn.
- Trạng thái không BOOKED: ẩn 2 nút, hiện pill + "Đã xử lý" (dòng 316–318).
- `processingId` disable nút hàng đang gọi API (chống double-click / double-count).

## Optimistic update (mục 7): OK

Sau check-in thành công (AttendancePage.tsx:118–134):
- Đổi `bookingStatus = 'ATTENDED'` cho đúng hàng → `isBooked=false` → ẩn 2 nút. OK.
- `checkedInCount + 1` cập nhật ở **cả** `sessions` (list card) và `selectedSession` (header panel). OK.
- No-show chỉ đổi status, không đổi counter — đúng (checkedInCount đếm số ATTENDED).

## Race prevention (mục 8): OK

- Effect load sessions (mount): `let active = true` + cleanup `active = false` (dòng 68–85), guard mọi setState.
- Effect load attendees (đổi selectedSession): `let active = true` + cleanup (dòng 88–112), guard setState. OK.

## Issues

- **WARNING** — `Layout.tsx:16`: title map `/reception/attendance` = `'Điểm danh'`, nhưng checklist/spec yêu cầu **"Điểm danh hôm nay"**. Header thanh trên hiển thị "Điểm danh". Không block (bản thân trang đã có `<h1>Điểm danh hôm nay</h1>` tại AttendancePage.tsx:178), nhưng nên đổi cho đúng spec.
- **WARNING** — `attendance.ts:11`: FE khai báo `SessionSummary.trainerName: string` (non-nullable), nhưng backend `trainerName` **có thể null** (buổi không gán HLV, hoặc `trainerProfile.userAccount == null` — AttendanceService.java:113). Khi null, UI render "HLV: " (React bỏ qua null, không crash) — chỉ lệch type/cosmetic. Nên đổi thành `string | null` và fallback hiển thị (vd "—").

Ghi chú phụ (không phải lỗi UC5.3): `parseApiError` (auth.ts:39–41) nếu `response.data` là mảng rỗng sau filter sẽ trả `[]`, khiến `parseApiError(err)[0].message` crash. Các endpoint UC5.3 trả lỗi dạng object đơn (ApiException) nên không kích hoạt case này; đây là util dùng chung, ngoài phạm vi UC5.3.

## Kết luận

Tích hợp UC5.3 **PASS**. API shape khớp hoàn toàn, 4 business rule (BR-1..BR-4) đúng, security bọc class-level + method-security bật thật + route FE bảo vệ đúng role, routing/nav/optimistic/race-prevention đều đạt. Chỉ còn 2 WARNING cosmetic (title header "Điểm danh" vs "Điểm danh hôm nay"; type `trainerName` nên nullable) — không chặn phát hành, nên sửa khi tiện.
