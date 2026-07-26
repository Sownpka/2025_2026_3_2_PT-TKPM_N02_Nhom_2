# Backend UC2.2 — Xem gói tập & lịch sử tập — DONE

Trạng thái: Đã implement + `mvn -o compile` PASS (exit 0), tất cả class đã sinh trong `target/classes`.

## Files đã tạo

| # | File | Vai trò |
|---|------|---------|
| 1 | `com/picore/booking/Booking.java` | Entity stub bảng `booking` |
| 2 | `com/picore/booking/BookingRepository.java` | JpaRepository + JPQL `findHistory` |
| 3 | `com/picore/me/dto/MyPackageResponse.java` | Record DTO gói tập |
| 4 | `com/picore/me/dto/MyHistoryItem.java` | Record DTO buổi tập |
| 5 | `com/picore/me/MeService.java` | Service layer |
| 6 | `com/picore/me/MeController.java` | REST controller `@RequestMapping("/me")` |

## Files đã sửa

- `com/picore/member/MemberRepository.java` — thêm `Optional<Member> findByUserAccountId(Long userAccountId)`.

## API endpoints

Context-path ứng dụng là `/api` (application.yml), nên đường dẫn thực tế:

### `GET /api/me/packages`
- Chỉ `MEMBER` (`@PreAuthorize("hasRole('MEMBER')")`).
- userId lấy từ `@AuthenticationPrincipal UserPrincipal.id()` — KHÔNG dùng query param.
- Trả danh sách gói của hội viên đang đăng nhập.
- Fields: `id, packageTypeName, category, sessionsRemaining, startDate, endDate, status, nearExpiry`.
- Sắp xếp: ACTIVE trước, rồi `startDate DESC` (sort ổn định trên kết quả repo đã sort startDate DESC).
- `nearExpiry = true` khi `sessionsRemaining != null && <= 2` HOẶC `endDate - today <= 7 ngày`.

### `GET /api/me/history?filter=WEEK|MONTH|CUSTOM&from=yyyy-MM-dd&to=yyyy-MM-dd`
- Chỉ `MEMBER`.
- Chỉ trả buổi `ATTENDED` + `NO_SHOW` (không trả `BOOKED`/`CANCELLED`).
- `filter` mặc định = `MONTH` (từ ngày 1 tháng hiện tại → hôm nay).
  - `WEEK`: từ Thứ Hai (đầu tuần hiện tại) → hôm nay.
  - `CUSTOM`: bắt buộc cả `from` và `to`; thiếu hoặc `from > to` → HTTP 400 (ApiException).
- Fields: `sessionDate, className, trainerName, startTime, endTime, attendanceStatus`.
- Sắp xếp: `sessionDate DESC, startTime DESC` (làm trong JPQL query).

## Ghi chú quan trọng

- **Booking là entity STUB.** Bảng `booking` chưa có nghiệp vụ đặt lịch/điểm danh. Fields: `id, classSessionId, memberId, memberPackageId, status ENUM(BOOKED,CANCELLED,ATTENDED,NO_SHOW), bookedAt, cancelledAt, checkedInAt`. UC5.1 (đặt lịch) / UC5.3 (điểm danh) sẽ populate + implement Controller/Service.
- **`/me/history` sẽ trả về danh sách RỖNG** cho đến khi UC5.1/UC5.3 tạo dữ liệu booking ATTENDED/NO_SHOW. Query đã sẵn sàng, chỉ chờ data.
- **`findHistory` dùng ad-hoc JOIN** `Booking b JOIN ClassSession cs ON cs.id = b.classSessionId` (không có association mapping giữa 2 entity — chỉ dùng khóa Long). Status so khớp bằng hằng enum FQN (`com.picore.booking.Booking.BookingStatus.ATTENDED/NO_SHOW`) theo đúng convention của `ClassSessionRepository`.
- **Resolve dữ liệu trong service (tránh N+1):** batch-load `ClassSession` (findAllById theo classSessionId), rồi batch-load tên lớp `GymClass` và tên HLV `TrainerProfile.userAccount.fullName`.
  - `className`: nếu `gymClassId != null` → tên `GymClass`; nếu là buổi riêng → "Buổi 1-1"/"Buổi 1-2" theo `ClassSession.type` (PRIVATE_1_1/PRIVATE_1_2), fallback "Buổi tập".
  - `trainerName`: `TrainerProfile.id (= class_session.trainer_id)` → `userAccount.fullName`.
- **Lệch nhẹ so với spec inject:** MeService KHÔNG inject `UserAccountRepository`. Tên HLV lấy trực tiếp qua `TrainerProfile.getUserAccount()` (quan hệ đã `FetchType.EAGER`), nên `UserAccountRepository` là thừa — đã bỏ để tránh dead injection. Các repo còn lại inject đúng theo spec: MemberRepository, MemberPackageRepository, BookingRepository, ClassSessionRepository, GymClassRepository, TrainerRepository.
- **Xác định hội viên:** luôn qua `memberRepository.findByUserAccountId(currentUserId)`; không có → HTTP 404 (ApiException). Không nhận memberId từ client.
- `MyPackageResponse` KHÔNG dùng `@JsonInclude(NON_NULL)` (khác `MemberPackageResponse`) để field `category`/`sessionsRemaining` null vẫn xuất hiện rõ ràng cho FE. Có thể chỉnh nếu FE muốn ẩn null.
