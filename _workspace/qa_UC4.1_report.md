# QA Report UC4.1 — Quản lý lớp học

## Kết quả: NEEDS_REVIEW
(Lõi ADMIN hoạt động đầy đủ, backend đúng spec. 01 vấn đề tích hợp: RECEPTIONIST bị chặn khỏi UI dù backend + spec cho phép.)

## Checklist

| Hạng mục | Status | Ghi chú |
|---|---|---|
| **1. API Contract** | | |
| 6 endpoints URL+method khớp | PASS | classes GET/POST/PUT, /status PATCH, /timetable GET, /trainers/available-for-class GET. baseURL `/api` (client.ts) + controller không prefix → khớp. |
| GymClassResponse fields khớp TS | PASS | `List<String> daysOfWeek`→`DayOfWeek[]` (backend trả mã 3 ký tự MON..SUN, đúng union TS). `int capacity`→`number`. `status` String→`Status`. |
| startTime/endTime serialize + cắt HH:mm | PASS | FE `hhmm()` slice(0,5) an toàn cho cả "08:00" lẫn "08:00:00". Gửi lên "HH:mm" từ input type=time, backend LocalTime parse được. |
| TimetableSession khớp TS | PASS | `sessionDate` LocalDate→string, `dayOfWeek` 3 ký tự→`DayOfWeek`, tất cả field còn lại khớp. |
| available-for-class nhận `days` CSV | PASS | FE gửi `days=MON,WED` (join ','). Backend `@RequestParam List<String>` — Spring tự split CSV thành List. OK. |
| Error `{field,message}` unpack đúng | PASS | `parseApiError` xử lý cả mảng (@Valid) lẫn object đơn (ApiException). `applyErrors` map field→highlight. |
| **2. Form logic** | | |
| Trainer dropdown disabled đến khi đủ ≥1 ngày + 2 giờ | PASS | `trainerSelectable = days.length>0 && startTime && endTime`; select `disabled`. |
| Chọn loại thiết bị → countByType + hint | PASS | `loadTypeCounts` khi mở modal; `equipmentHint` "Hiện có N máy loại này" match trim+lowercase. |
| Edit prefill daysOfWeek + giờ cắt | PASS | `openEditModal` sort days, `hhmm()` cho startTime/endTime, prepend HLV đang gán vào options. |
| **3. Error Handling** | | |
| E-1 trùng tên → highlight `name` | PASS | Backend `existsByName`/`existsByNameAndIdNot` → field=name. FE map vào fieldErrors.name. |
| E-3 trainer conflict → highlight `trainerId` | PASS | Backend field=trainerId, message đúng nguyên văn. FE highlight. |
| Validation thiếu trường (mảng) → highlight từng field | PASS | @NotBlank/@NotNull/@NotEmpty/@Positive message "Trường này là bắt buộc"; FE map từng field. |
| **4. Business Rules** | | |
| POST generate sessions → saveAll batch | PASS | `generateSessions` gom List rồi `saveAll`. Horizon Thứ Hai tuần hiện tại → +8 tuần. |
| Soft delete PATCH + xóa future sessions | PASS | `deactivate` set INACTIVE + `deleteFutureSessionsByGymClassId(id, today)`. |
| E-3 kiểm PRIVATE overlap ở backend | PASS | `findConflictingPrivateSessions` (type IN PRIVATE_1_1/1_2, overlap giờ) + lọc day-of-week. Enforce ở service, không chỉ FE. |
| Update: xóa future + re-generate từ ngày mai | PASS | `deleteFutureSessionsByGymClassId(id, today)` rồi generate từ `today+1`. Giữ sessions đã qua/hôm nay. |
| Audit log | PASS | CREATE_CLASS/UPDATE_CLASS/DEACTIVATE_CLASS, entity="gym_class". |
| **5. Phân quyền** | | |
| Controller `hasAnyRole('ADMIN','RECEPTIONIST')` | PASS | Cả 5 endpoint classes/timetable + available-for-class đều đúng. |
| Route `/admin/classes` dưới ProtectedRoute ADMIN | PASS (kỹ thuật) | Mount đúng dưới nhánh ADMIN. |
| ⚠ RECEPTIONIST truy cập được UI? | **FAIL** | Không có route `/reception/classes`. Backend + spec cho LỄ TÂN nhưng FE chỉ mount dưới ADMIN → LỄ TÂN bị chặn khỏi giao diện. Xem Issue #1. |
| **6. UI Labels** | | |
| Pills lịch học MON→T2..SUN→CN | PASS | `DAY_LABEL` đúng ánh xạ, render theo `DAY_ORDER` cố định. |
| Toast thành công (3 chuỗi) | PASS | "Thêm lớp học thành công!" / "Cập nhật lớp học thành công!" / "Đã ngừng hoạt động lớp học." — đúng nguyên văn. |
| Confirm xóa | PASS | "Bạn có chắc muốn ngừng lớp học này? Tất cả lịch tập tương lai của lớp sẽ bị hủy." — đúng nguyên văn. |
| Timetable trống | PASS | "Chưa có lớp nào trong tuần này." |
| **7. Timetable** | | |
| Week nav ← → ISO week | PASS | `shiftWeek`/`toISOWeek`/`mondayOfISOWeek` chuẩn ISO 8601, khớp format backend "YYYY-Www". |
| Card: tên lớp + HLV + X chỗ | PASS | ClassCard hiển thị className (bold) + trainerName + giờ + `availableSpots` chỗ. |

## Issues

### Issue #1 — [MEDIUM] RECEPTIONIST bị chặn khỏi UI lớp học
- **File:** `frontend/src/App.tsx:33-61` (chỉ mount `/admin/classes` dưới `ProtectedRoute allowedRoles={['ADMIN']}`).
- **Mô tả:** Spec UC4.1 nêu vai trò "ADMIN + LỄ TÂN"; backend `GymClassController` + `TrainerController.getAvailableForClass` dùng `hasAnyRole('ADMIN','RECEPTIONIST')`. Nhưng frontend không có route `/reception/classes` và sidebar LỄ TÂN không có mục "Lớp học". Kết quả: LỄ TÂN có quyền API nhưng không có đường vào giao diện → tính năng khuyết cho 1 trong 2 vai trò bắt buộc.
- **Gợi ý fix:** Thêm `<Route path="/reception/classes" element={<AdminClassesPage />} />` dưới nhánh `ProtectedRoute allowedRoles={['RECEPTIONIST']}` + thêm mục "Lớp học" vào sidebar LỄ TÂN. Trang dùng chung được (không hardcode path admin). frontend-dev đã ghi nhận là "ngoài scope file list UC4.1" — cần orchestrator quyết định đưa vào UC4.1 hay tạo task follow-up.

### Issue #2 — [LOW] Type nullability chưa khớp thực tế backend
- **File:** `frontend/src/types/class.ts:6-18`.
- **Mô tả:** `GymClassResponse.description`, `equipmentType`, `trainerName` khai báo `string` (non-null) nhưng backend có thể trả `null` (description/equipmentType chưa nhập; trainerName null nếu trainer thiếu userAccount). FE đã phòng thủ tại nơi dùng (`?? ''`, `|| '—'`) nên không lỗi runtime, chỉ là type chưa chính xác.
- **Gợi ý fix:** Đổi thành `string | null` (hoặc `?`) cho 3 field trên để phản ánh đúng contract.

### Issue #3 — [INFO] Thông báo lỗi capacity ≤ 0 dùng "Trường này là bắt buộc"
- **File:** `backend/.../dto/CreateClassRequest.java:18` (`@Positive(message = "Trường này là bắt buộc")`).
- **Mô tả:** Khi capacity = 0 hoặc âm, message hiển thị "Trường này là bắt buộc" (nghĩa là "thiếu"), hơi lệch ngữ nghĩa. Spec E-2 liệt kê sức chứa là trường bắt buộc nên chấp nhận được; ghi nhận để cân nhắc dùng message riêng như "Sức chứa phải lớn hơn 0" nếu muốn chính xác hơn.

## Điểm tốt
- Shape alignment backend↔TS đạt gần như hoàn hảo; `hhmm()` slice(0,5) xử lý robust cho cả "08:00" và "08:00:00" — không phụ thuộc chi tiết serialize của Jackson.
- E-3 (R4.8) enforce đúng ở backend với overlap `NOT(end<=start OR start>=end)` + lọc day-of-week, defense-in-depth cùng available-for-class ở FE.
- Xử lý lỗi 2 dạng (mảng @Valid + object đơn ApiException) thống nhất qua `parseApiError`/`applyErrors`.
- Toàn bộ nhãn/toast/confirm tiếng Việt đúng nguyên văn spec.
- available-for-class có chống race (cancel token) khi ngày/giờ đổi liên tục; edit mode prepend HLV đang gán tránh mất selection.
- Auto-generate/re-generate sessions + soft delete + audit log đúng logic spec; horizon 8 tuần nhất quán giữa create/update/available-for-class.
