# UC5.2 — Đăng ký buổi 1-1 / 1-2 (Backend) — DONE

Package: `com.picore.private_booking`. Build: `mvn -o compile` → **BUILD SUCCESS**.

## Files đã TẠO

| File | Nội dung |
|------|----------|
| `private_booking/dto/PrivateSlotsResponse.java` | record `PrivateSlotsResponse(targetWeek, deadlinePassed, slots)` + nested `SlotEntry(trainerId, trainerName, date, dayOfWeek, startTime, endTime, available)` |
| `private_booking/dto/CreatePrivateBookingRequest.java` | record `(trainerId, date, startTime, memberPackageId, partnerMemberId, joinMatchmaking)` |
| `private_booking/PrivateBookingService.java` | `getSlots(userId, week)` + `createPrivateBooking(userId, req)` |
| `private_booking/PrivateBookingController.java` | `GET /slots`, `POST /` (đều `@PreAuthorize hasRole('MEMBER')`) |

## Files đã SỬA

| File | Thay đổi |
|------|----------|
| `clazz/ClassSessionRepository.java` | Thêm `List<ClassSession> findPrivate12Sessions(trainerId, date, startTime)` — trả **List** (không phải Optional) để tránh `NonUniqueResultException` khi 1 khung giờ có cả buổi full + buổi mới; service tự đếm booking để chọn buổi còn chỗ. |
| `booking/BookingService.java` | Trong `cancelInternal`, sau khi save booking CANCELLED: nếu không còn booking BOOKED/ATTENDED nào → xóa `ClassSession` orphan (chỉ với buổi type != GROUP và chưa diễn ra). Dùng `classSessionRepository` + `ClassSession` đã import sẵn — **không sửa gì khác**. |

## Endpoints

- `GET  /api/private-booking/slots?week=YYYY-Www` → `PrivateSlotsResponse`
- `POST /api/private-booking` (body `CreatePrivateBookingRequest`) → `201 BookingResponse`

(Context-path `/api` áp cho toàn app.)

## Logic chính

### getSlots
1. Tìm member theo userId. Nếu chưa có gói ACTIVE GOI_1_1/GOI_1_2 còn hạn → trả `slots=[]`, `deadlinePassed=false` (E-2 để frontend xử lý).
2. `deadlinePassed = now > (Chủ Nhật 23:59 tuần hiện tại)`.
3. `targetWeek`: mặc định = tuần sớm nhất được đăng ký (tuần kế, hoặc kế +1 nếu quá hạn); nếu truyền param `week` thì override.
4. Grid = mỗi HLV ACTIVE × mỗi ngày T2→CN × 12 slot (06–12h, 13–19h, bước 1h). `available = findConflictingSessions(...).isEmpty()`.

### createPrivateBooking
1. Validate gói: đúng chủ, ACTIVE, còn hạn, còn buổi (hoặc null = không giới hạn), category ∈ {GOI_1_1, GOI_1_2}.
2. Deadline: nếu `mondayOf(date) < earliestBookableMonday` → **400** "Đã hết hạn đăng ký cho tuần này".
3. `@Transactional`:
   - **1-1**: check conflict → nếu có **409**; tạo `ClassSession` capacity=1.
   - **1-2**: ưu tiên ghép vào buổi 1-2 cùng khung giờ còn chỗ (`bookedCount < 2`, member chưa tham gia). Không có buổi ghép → check conflict (409 nếu vướng) → tạo mới capacity=2; nếu `partnerMemberId != null` (và không phải matchmaking) → tạo thêm booking thứ 2 cho partner (memberPackageId = null); nếu `joinMatchmaking` hoặc không chọn gì → để buổi chờ ghép sau.
   - Tạo `Booking(BOOKED)`, trừ buổi nếu `sessionsRemaining != null`.
4. Notify: `sendBookingConfirmation(member, booking)` + log mock cho HLV (`trainer.userAccount.id`), bọc `notifyQuietly`.

## Ghi chú / lệch nhẹ so với đặc tả

- `findPrivate12Session` → đổi thành `findPrivate12Sessions` trả **List** (an toàn hơn Optional; Optional sẽ crash nếu có >1 buổi cùng khung giờ).
- Conflict-check cho gói 1-2 chỉ chạy ở nhánh **tạo buổi mới**, không chạy khi **ghép** vào buổi có sẵn — nếu không, việc ghép cặp (dùng chung khung giờ HLV) sẽ luôn bị chính buổi đó chặn bởi `findConflictingSessions`.
- Partner booking dùng `memberPackageId = null` (đặc tả không nêu gói của partner); partner sẽ đối soát gói riêng khi điểm danh.
- `BookingService` **KHÔNG** tạo mới; chỉ chèn block xóa orphan trong `cancelInternal`.
