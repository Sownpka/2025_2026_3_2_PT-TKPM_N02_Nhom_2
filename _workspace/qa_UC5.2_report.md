# QA Verify Report — UC5.2 (Đăng ký buổi 1-1/1-2)

- **Ngày:** 2026-07-18
- **Verdict:** **PASS (with warnings)**
- **Issues:** CRITICAL 0 · WARNING 2 · INFO 5

Shape alignment, security, các business rule chính, và toàn bộ frontend flow đều khớp spec.
Hai điểm cần chú ý: (1) matchmaking gói 1-2 gần như không tới được qua UI, (2) chống race
condition khi tạo ClassSession mới chưa có khóa DB.

---

## 1. Shape alignment — PASS

| Kiểm tra | Kết quả |
|---|---|
| `PrivateSlotsResponse` (targetWeek, deadlinePassed, slots[]) ↔ TS | OK khớp |
| `SlotEntry` (trainerId, trainerName, date, dayOfWeek, startTime, endTime, available) ↔ TS | OK khớp (Long→number, boolean→boolean) |
| `CreatePrivateBookingRequest` ↔ body FE | OK — trainerId, date, startTime, memberPackageId, partnerMemberId, joinMatchmaking đều khớp |
| POST trả `BookingResponse` (id, classSessionId, status, bookedAt) ↔ TS | OK — `bookedAt` LocalDateTime → serialize ISO string, TS `string` khớp |
| Endpoints FE (`/private-booking/slots`, `/private-booking`) ↔ controller `@RequestMapping("/private-booking")` | OK (context-path `/api` bổ sung ở client) |

## 2. Security — PASS

- `GET /private-booking/slots` — `@PreAuthorize("hasRole('MEMBER')")` OK.
- `POST /private-booking` — `@PreAuthorize("hasRole('MEMBER')")` OK.
- Cả 2 lấy member từ `@AuthenticationPrincipal UserPrincipal.id()`, KHÔNG nhận memberId qua
  param/body. Service `requireMemberByUser(userId)` → `memberRepository.findByUserAccountId`. OK.
- `requirePrivatePackage` verify ownership (`member.getId().equals(pkg.getMember().getId())`) → chống
  đặt bằng gói người khác. OK.

## 3. Business rules

| Rule | Kết quả |
|---|---|
| Gói phải ACTIVE + category GOI_1_1/GOI_1_2 + còn buổi | OK — `requirePrivatePackage` check status ACTIVE, endDate chưa hết, sessionsRemaining null hoặc >0, category ∈ PRIVATE_CATEGORIES |
| `deadlinePassed` = CN 23:59 tuần hiện tại đã qua | OK — `isDeadlinePassed`: sunday = nextOrSame(SUNDAY), deadline 23:59, `now.isAfter(deadline)` |
| targetWeek = tuần kế / tuần+2 nếu quá hạn | OK — `earliestBookableMonday`: thisMonday +7 (chưa hạn) hoặc +14 (quá hạn) |
| Slot trống = không ClassSession nào (GROUP/PRIVATE) conflict | OK — `findConflictingSessions(trainerId, date, date, start, end)` bao mọi type, overlap `NOT(end<=start OR start>=end)` |
| Check conflict lại trong transaction trước khi tạo session | **PARTIAL** — có `requireNoConflict` trong `@Transactional`, nhưng KHÔNG có pessimistic lock / unique constraint (xem WARNING-1) |
| Gói 1-2 matchmaking: ghép session chưa đủ người, không có thì tạo mới | Code OK (`findJoinable12Session` đếm booking <2 và chưa join), NHƯNG đường đi UI hầu như không kích hoạt được (xem WARNING-2) |
| Trừ buổi chỉ khi `sessionsRemaining != null` | OK — dòng 208-211 |
| `cancelInternal` xóa ClassSession orphan | OK — remaining==0 && type != GROUP && date >= today → `delete(cs)`. Áp dụng đúng cho PRIVATE_1_1/1_2, chừa GROUP. Hoàn buổi trước khi xóa. |

### WARNING-1 — Race condition chưa được khóa ở tầng DB
`createPrivateBooking` gọi `requireNoConflict()` rồi `createSession()` trong cùng `@Transactional`,
nhưng slot buổi private là **hàng mới chưa tồn tại** nên không có row để `findByIdForUpdate`
(PESSIMISTIC_WRITE như UC5.1). `findConflictingSessions` chỉ SELECT thường, không lock. Hai request
đồng thời cùng slot trống có thể cùng qua check và cùng INSERT 2 ClassSession trùng khung giờ HLV.
Spec note #2 yêu cầu "check lại slot trước khi INSERT để tránh race" — hiện mới đạt mức đọc-lại,
chưa có bảo vệ thật. Đề xuất: unique constraint (trainer_id, session_date, start_time) cho buổi
PRIVATE, hoặc lock hàng HLV/ngày.

### WARNING-2 — Matchmaking gói 1-2 gần như không reachable qua UI
Grid slot đánh dấu `available = findConflictingSessions(...).isEmpty()`. Khi người đầu tiên đặt 1-2
vào slot trống, một `ClassSession PRIVATE_1_2` được tạo → slot đó lập tức thành `available=false`
("Đã đặt", nút disabled). Người thứ hai không còn click được slot đó, nên `findJoinable12Session`
(ghép vào buổi 1 người) thực tế không bao giờ có cơ hội chạy từ luồng UI. Kết quả: cơ chế "Để hệ
thống ghép" tạo ra buổi chờ 1 người nhưng không ai ghép vào được. E-4 (dialog "chưa có ai chờ ghép")
cũng chưa được implement ở frontend — hiện tạo session chờ một cách âm thầm. Đây là hạn chế chức năng
thực sự của matchmaking, không chỉ cosmetic.

## 4. Frontend flow — PASS

- Route `/member/private-booking` → `PrivateBookingPage` (App.tsx dòng 17, 94). Không còn Placeholder. OK.
- E-2: `packagesLoaded && !hasPrivatePackage` → card amber cảnh báo, không render form. OK.
- Banner deadline vàng khi `slotsData.deadlinePassed`. OK (bg-yellow-50 border-yellow-300).
- Chọn HLV (nút teal khi active) → grid slot theo ngày × giờ. OK. Auto chọn HLV đầu tiên.
- Grid: slot `available` → nút teal "Trống"; `!available` → nút xám disabled "Đã đặt"; không có slot → "–". OK.
- Confirm modal: section "Người đồng hành" chỉ khi `isCombo12` (category GOI_1_2). OK.
- POST thành công → toast success + `Promise.all([loadSlots(), loadPackages()])` refresh. OK.
- 409 → `closeConfirm()` + toast + `loadSlots()`. OK. (400/422/khác → chỉ toast, giữ modal.)

## 5. Labels tiếng Việt — PASS

| Item | Kết quả |
|---|---|
| E-2 card | OK khớp chính xác: "Bạn chưa có gói 1-1/1-2 còn hiệu lực. Vui lòng liên hệ lễ tân để đăng ký gói phù hợp." |
| E-3 (409) backend | OK: "Khung giờ này vừa được đặt bởi người khác. Vui lòng chọn khung giờ khác." — FE hiển thị message server |
| E-1 deadline | Banner FE: "Đã hết hạn đăng ký cho tuần kế tiếp. Đang hiển thị lịch cho tuần …" — OK; backend POST 400 rút gọn "Đã hết hạn đăng ký cho tuần này" (xem INFO-1) |
| Nút | "Xác nhận đặt lịch" / "Hủy" — khớp checklist (xem INFO-2) |

## 6. Ghi chú hạn chế đã biết — CONFIRMED

"Mời hội viên cụ thể" → `partnerMemberId = null`. Được ghi chú rõ ở **hai** nơi:
- `privateBooking.ts` dòng 28: comment "(backend resolve id)".
- `PrivateBookingPage.tsx` dòng 236-237 & 500-506: comment giải thích + text amber hiển thị cho user
  "Tính năng mời trực tiếp đang được hoàn thiện…". Luôn gửi `partnerMemberId: null`.

Backend `createPartnerBooking` đã có sẵn (resolve theo memberId, chống mời chính mình) — chỉ thiếu
bước resolve email/SĐT → memberId. Khớp spec note #6.

---

## INFO (không chặn)

- **INFO-1:** Message lỗi POST của backend ngắn hơn spec: E-1 thiếu vế "Vui lòng đăng ký cho tuần kế
  tiếp."; E-2 422 chỉ "Bạn chưa có gói 1-1/1-2 còn hiệu lực". FE hiển thị message từ server nên vẫn
  đọc được; nên đồng bộ để đúng spec.
- **INFO-2:** Spec dòng 179 ghi nút "Xác nhận đăng ký" nhưng checklist + FE dùng "Xác nhận đặt lịch".
  Không lệch chức năng; FE bám theo checklist.
- **INFO-3:** POST chỉ kiểm tra cận dưới của deadline (`mondayOf(date).isBefore(earliestMonday)` → 400).
  Không có cận trên → member có thể POST `date` ở tuần bất kỳ xa trong tương lai (dù grid chỉ hiển thị
  1 tuần). Nên validate `date` nằm đúng trong `targetWeek`.
- **INFO-4:** `notifyTrainer` chỉ `log.info(...)`, KHÔNG gọi `notificationService`. Spec note #5 / luồng
  cơ bản step 6 yêu cầu thông báo cả HLV. Hội viên được `sendBookingConfirmation`, HLV mới ở mức stub.
- **INFO-5:** `getSlots` trả grid rỗng khi không có gói (E-2) — FE tự chặn gọi slots bằng
  `hasPrivatePackage` nên nhất quán; không vấn đề.

## Kết luận

Tích hợp BE↔FE cho UC5.2 **đạt** ở mọi trục shape/security/flow/label; không có lỗi CRITICAL. Cần xử
lý trước khi coi là hoàn chỉnh: WARNING-1 (khóa race khi tạo session) và WARNING-2 (matchmaking 1-2
không reachable + thiếu E-4). Các INFO là đồng bộ message/validate biên và hoàn thiện thông báo HLV.
