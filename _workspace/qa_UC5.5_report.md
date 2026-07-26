# QA Report — UC5.5 (Xem danh sách học viên — HLV)

## Kết quả: PASS

Tích hợp backend ↔ frontend khớp toàn bộ. Không phát hiện lỗi chặn (blocker). Chỉ có 1 ghi chú nhỏ (WARNING) về UX header, đã được FE chủ động chấp nhận.

## API Shape: OK

`SessionAttendeesResponse` (Java record) khớp 1-1 với TypeScript trong `trainerSchedule.ts`:

| Field | Backend | Frontend | Khớp |
|-------|---------|----------|------|
| sessionInfo.sessionId | `Long` | `number` | OK |
| sessionInfo.className | `String` | `string` | OK |
| sessionInfo.sessionDate | `String` "yyyy-MM-dd" (DATE_FMT) | `string` | OK |
| sessionInfo.startTime | `String` "HH:mm" (TIME_FMT) | `string` | OK |
| sessionInfo.endTime | `String` "HH:mm" | `string` | OK |
| sessionInfo.trainerName | `String` | `string` | OK |
| sessionInfo.isPast | `boolean isPast` | `boolean` | OK (xem ghi chú Jackson) |
| attendees[].bookingId | `Long` | `number` | OK |
| attendees[].memberName | `String` | `string` | OK |
| attendees[].phone | `String` nullable | `string \| null` | OK |
| attendees[].bookingStatus | `String` name() | `'BOOKED'\|'CANCELLED'\|'ATTENDED'\|'NO_SHOW'` | OK |
| attendees[].checkedInAt | `String` "yyyy-MM-dd'T'HH:mm:ss" nullable | `string \| null` | OK |

Ghi chú serialization boolean `isPast`: đã kiểm chứng bằng tiền lệ `MemberPackageResponse.isPrivatePackage`
(cùng dạng record boolean `is`-prefixed). FE tiêu thụ đúng key `isPrivatePackage` (memberPackage.ts:23,
RegisterPackagePage.tsx:146) và tính năng đó đang chạy → Jackson của dự án (Spring Boot 3.3.6 / Jackson 2.17)
serialize component `isPast` thành JSON key `"isPast"`, khớp FE. Không mismatch.

## Endpoint URL: OK

- Controller: `@RequestMapping("/trainer")` (class) + `@GetMapping("/sessions/{sessionId}/attendees")` (method)
  → `/trainer/sessions/{id}/attendees`.
- Context-path `/api` → URL cuối `/api/trainer/sessions/{id}/attendees`.
- Frontend: `TRAINER_API.SESSION_ATTENDEES(id)` = `/trainer/sessions/${id}/attendees` (endpoints.ts:76),
  baseURL client `/api` → `/api/trainer/sessions/{id}/attendees`.
- Khớp hoàn toàn (prefix `/trainer` đã có ở cả 2 phía).

## Business Rules: OK

- **BR-1** (security guard) — OK. Service.java:169 `if (!trainer.getId().equals(session.getTrainerId()))`
  → `ApiException(FORBIDDEN, "Bạn không có quyền xem buổi học này")`. trainerId suy từ JWT `principal.id()`,
  không nhận từ param.
- **BR-2** (CANCELLED không bị lọc) — OK. `findByClassSessionIdOrderByBookedAtAsc(Long)`
  (BookingRepository.java:68) là derived query thuần theo classSessionId, không có mệnh đề status
  → trả mọi trạng thái kể cả CANCELLED.
- **BR-3** (isPast, today = past) — OK. Service.java:177 `!session.getSessionDate().isAfter(LocalDate.now())`
  tức `sessionDate <= today`.
- **BR-4** (sort) — OK. Comparator (Service.java:199-206): key `CANCELLED ? 1 : 0` (non-CANCELLED trước,
  CANCELLED sau) → then `memberName` (A→Z). BOOKED/ATTENDED/NO_SHOW đều nhóm 0.

## Security: OK

- Backend: `@PreAuthorize("hasRole('TRAINER')")` ở class-level `TrainerScheduleController` (dòng 21)
  → áp cho cả endpoint mới. Cộng thêm object-level guard BR-1.
- Frontend: route `/trainer/session/:sessionId/attendees` nằm trong
  `<ProtectedRoute allowedRoles={['TRAINER']}>` (App.tsx:97-105), bọc trong `<Layout>`.

## UX/Labels: OK

- Cột "Điểm danh" chỉ render khi `isPast === true` — OK (SessionAttendeesPage.tsx:107 `<th>`, :120 `<td>`).
- Pill điểm danh: ATTENDED→"Có mặt" (xanh lá), NO_SHOW→"No-show" (đỏ), còn lại→"—" (xám) — OK (dòng 122-128).
- Pill trạng thái đặt: BOOKED→"Đã đặt" (blue-100/700), CANCELLED→"Đã hủy" (gray-100/600),
  ATTENDED→"Đã tập" (green-100/700), NO_SHOW→"No-show" (red-100/700) — OK (BOOKING_PILL, dòng 11-16).
- SĐT null → "—" — OK (`a.phone ?? '—'`, dòng 116).
- E-1 empty: "Chưa có hội viên đăng ký cho buổi này" — OK (dòng 140-144, điều kiện `attendees.length === 0`).
- Nút quay lại → `navigate('/trainer/schedule')` — OK (dòng 72).

## Entry point: OK

- `TrainerSchedulePage.tsx:186` `navigate(`/trainer/session/${session.sessionId}/attendees`)`
  khớp chính xác route pattern `/trainer/session/:sessionId/attendees` (App.tsx:101).

## Issues

- [SessionAttendeesPage.tsx / Layout.tsx — WARNING] Header hệ thống (thanh trên) hiện "PiCore" thay vì
  tên trang vì route có param không khớp `PAGE_TITLES` (exact match). FE đã chủ động chấp nhận và render
  tên buổi ở H2 trong nội dung trang. Không phải bug chức năng, chỉ là ghi chú UX.
- [SessionAttendeesPage.tsx:45-46 — INFO] `Number(sessionId)` với sessionId không phải số → `id` là NaN
  (falsy) → `if (!id) return`, không gọi API (trang trống, không crash). Hành vi an toàn, đúng như FE mô tả.

## Kết luận

UC5.5 PASS. Backend và frontend tích hợp nhất quán: API shape, endpoint URL (`/api/trainer/sessions/{id}/attendees`),
4 business rule (security guard, không lọc CANCELLED, isPast<=today, sort non-CANCELLED trước), phân quyền TRAINER
2 tầng (route + `@PreAuthorize` + object-level guard), và toàn bộ nhãn/pill/empty-state/nút quay lại đều khớp spec.
Không có lỗi chặn. Rủi ro Jackson boolean `isPast` đã được loại trừ qua tiền lệ `isPrivatePackage` đang chạy.
Sẵn sàng merge.
