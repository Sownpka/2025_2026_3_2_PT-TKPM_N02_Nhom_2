# UC5.1 — Đặt & hủy lịch tập (backend) — DONE

Compile: `mvn -o compile` PASS.

## Files đã tạo

| File | Vai trò |
|------|---------|
| `com/picore/booking/Waitlist.java` | Entity `waitlist` (id, classSessionId, memberId, createdAt, notified=false) |
| `com/picore/booking/WaitlistRepository.java` | findByClassSessionIdOrderByCreatedAtAsc, existsByClassSessionIdAndMemberId, findFirstByClassSessionIdAndNotifiedFalseOrderByCreatedAtAsc |
| `com/picore/booking/BookingService.java` | Logic đặt/hủy/waitlist/getMyBookings |
| `com/picore/booking/BookingController.java` | POST /bookings, DELETE /bookings/{id}, POST /waitlist |
| `com/picore/booking/dto/CreateBookingRequest.java` | record (classSessionId, memberPackageId, memberId?) |
| `com/picore/booking/dto/BookingResponse.java` | record (id, classSessionId, status, bookedAt) |
| `com/picore/booking/dto/JoinWaitlistRequest.java` | record (classSessionId) |
| `com/picore/me/dto/MyBookingItem.java` | record cho GET /me/bookings |

## Files đã sửa

| File | Thay đổi |
|------|----------|
| `booking/BookingRepository.java` | + countByClassSessionIdAndStatusIn, existsByClassSessionIdAndMemberIdAndStatusIn, findByMemberIdAndStatusInOrderByBookedAtDesc, findByMemberIdAndClassSessionIdIn, findByClassSessionIdInAndStatusIn |
| `clazz/ClassSessionRepository.java` | + findByIdForUpdate (@Lock PESSIMISTIC_WRITE) |
| `clazz/dto/TimetableSession.java` | + field `String myBookingStatus` |
| `clazz/GymClassController.java` | GET /timetable mở cho MEMBER; truyền currentUserId (null nếu không phải MEMBER) |
| `clazz/GymClassService.java` | getTimetable(week, currentUserId); tính bookedCount thực + myBookingStatus (batch-query); inject BookingRepository, MemberRepository |
| `me/MeController.java` | + GET /me/bookings; inject BookingService |

## API endpoints (context-path /api)

| Method | Path | Role | Ghi chú |
|--------|------|------|---------|
| POST | /api/bookings | MEMBER, RECEPTIONIST | RECEPTIONIST đặt hộ cần memberId trong body; MEMBER lấy từ SecurityContext. 201 |
| DELETE | /api/bookings/{id} | MEMBER, RECEPTIONIST | MEMBER verify ownership; RECEPTIONIST hủy bất kỳ. 204 |
| POST | /api/waitlist | MEMBER | body {classSessionId}. 201 |
| GET | /api/me/bookings?status=UPCOMING\|COMPLETED\|CANCELLED | MEMBER | mặc định UPCOMING |
| GET | /api/timetable?week=YYYY-Www | ADMIN, RECEPTIONIST, MEMBER | MEMBER thấy myBookingStatus |

## Ghi chú quan trọng

- **Lock strategy**: `bookSession` chạy trong `@Transactional`, khóa buổi bằng
  `ClassSessionRepository.findByIdForUpdate` (`@Lock(PESSIMISTIC_WRITE)`) TRƯỚC khi đếm chỗ →
  tránh race condition vượt sức chứa khi nhiều người đặt cùng lúc.
- **Trình tự bookSession**: lock session (404) → đếm chỗ OCCUPYING=[BOOKED,ATTENDED] (409 "Lớp học đã đầy")
  → verify gói (owner + ACTIVE + endDate>=today + sessionsRemaining>0 → 422 "Bạn chưa có gói tập còn hiệu lực")
  → chống trùng (409) → tạo Booking(BOOKED) → trừ buổi nếu sessionsRemaining != null → save → notify (try-catch).
- **cancelBooking**: chỉ hủy khi status=BOOKED (409 nếu khác); set CANCELLED + cancelledAt;
  hoàn buổi (+1) nếu memberPackageId != null và sessionsRemaining != null;
  gọi `notifyWaitlistHead` → lấy người đầu waitlist chưa notified (FIFO) → notified=true → sendWaitlistInvite.
- **joinWaitlist**: chỉ cho vào waitlist khi lớp đã thực đầy (bookedCount >= capacity, 409 nếu còn chỗ);
  chống trùng người trong waitlist (409).
- **Notification**: dùng `NotificationService` có sẵn (sendBookingConfirmation, sendWaitlistInvite —
  MockNotificationService chỉ log). Bọc try-catch (`notifyQuietly`) để lỗi thông báo không rollback giao dịch.
  Chưa bật @EnableAsync trong repo nên gọi đồng bộ nhưng không chặn (mock rất nhẹ).
- **getMyBookings**: UPCOMING=[BOOKED] lọc sessionDate>=today sort ASC; COMPLETED=[ATTENDED] sort sessionDate DESC;
  CANCELLED sort cancelledAt DESC. Batch-load ClassSession/GymClass/Trainer→UserAccount (tránh N+1, theo pattern MeService).
- **Timetable myBookingStatus**: null khi ADMIN/RECEPTIONIST hoặc MEMBER chưa đặt; nếu MEMBER có nhiều bản ghi
  cùng buổi (đặt rồi hủy) ưu tiên trạng thái đang chiếm chỗ (BOOKED/ATTENDED) qua `preferActiveStatus`.
  bookedCount nay tính thật từ booking table (trước đây placeholder = 0).
- **RECEPTIONIST role**: xác định qua `UserPrincipal.role()` == "RECEPTIONIST".

## Lưu ý về schema (JPA ddl)

- Bảng mới `waitlist` do JPA quản lý (nếu ddl-auto=update sẽ tự tạo). Nếu dự án dùng migration script
  thủ công thì cần thêm bảng `waitlist` tương ứng.
