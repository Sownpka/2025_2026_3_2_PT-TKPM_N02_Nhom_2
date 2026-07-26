# Backend UC4.1 — Quản lý lớp học — DONE

Build: `mvn -o clean compile` → **BUILD SUCCESS**. Không tạo migration mới (V3 đã đủ schema).

## Files đã SỬA (mở rộng stub)

| File | Thay đổi |
|---|---|
| `clazz/GymClass.java` | Thêm 4 field: `equipmentType`, `daysOfWeek` (CSV, default `""`), `capacity`, `description` + getter/setter |
| `clazz/GymClassRepository.java` | `findAllByStatusOrderByIdAsc`, `existsByName`, `existsByNameAndIdNot` |
| `clazz/ClassSessionRepository.java` | `findByGymClassIdIsNotNull...Between...` (timetable), `findConflictingPrivateSessions` (E-3), `findConflictingSessions` (available-for-class), `deleteFutureSessionsByGymClassId` (@Modifying) |
| `trainer/TrainerService.java` | Thêm `getAvailableForClass(days, startTime, endTime)` + helper `parseDays` |
| `trainer/TrainerController.java` | Thêm `GET /trainers/available-for-class` |

## Files đã TẠO

```
clazz/GymClassService.java        — @Transactional CRUD + auto-generate sessions + E-3 + audit log
clazz/GymClassController.java     — @PreAuthorize hasAnyRole('ADMIN','RECEPTIONIST')
clazz/dto/CreateClassRequest.java
clazz/dto/UpdateClassRequest.java
clazz/dto/GymClassResponse.java
clazz/dto/TimetableResponse.java
clazz/dto/TimetableSession.java
trainer/dto/AvailableTrainerResponse.java  (record: id, fullName)
```

## API Summary

```
GET   /api/classes                          → 200 List<GymClassResponse>  (chỉ ACTIVE, sort id asc)
POST  /api/classes                          → 201 GymClassResponse
PUT   /api/classes/{id}                     → 200 GymClassResponse
PATCH /api/classes/{id}/status              → 200 GymClassResponse  (soft delete + xóa future sessions)
GET   /api/timetable?week=YYYY-Www          → 200 TimetableResponse (mặc định tuần hiện tại nếu thiếu week)
GET   /api/trainers/available-for-class?days=MON,WED&startTime=08:00&endTime=10:00
                                            → 200 List<AvailableTrainerResponse>
```
Tất cả `@PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")`.

## Logic đã implement

- **Auto-generate sessions**: horizon = từ Thứ Hai của tuần hiện tại đến +8 tuần (exclusive). Mỗi ngày khớp `daysOfWeek` → tạo `ClassSession(type=GROUP, capacity, trainerId)`.
- **Create**: generate từ Thứ Hai tuần hiện tại.
- **Update**: `deleteFutureSessionsByGymClassId(id, today)` (xóa `sessionDate > today`, giữ hôm nay & quá khứ) → re-generate từ **ngày mai** đến hết horizon 8 tuần.
- **Deactivate**: status=INACTIVE + xóa future sessions.
- **E-3 (R4.8)**: query PRIVATE_1_1/PRIVATE_1_2 của trainer trong horizon + overlap giờ `NOT (end<=start OR start>=end)`, lọc thêm theo day-of-week khớp request. Message đúng nguyên văn spec, field=`trainerId`, HTTP 400.
- **E-1**: `existsByName` / `existsByNameAndIdNot` → 400 field=`name` "Tên lớp học đã tồn tại".
- **Audit log**: `CREATE_CLASS` / `UPDATE_CLASS` / `DEACTIVATE_CLASS`, entity=`gym_class`.
- **days_of_week CSV**: serialize sắp xếp theo thứ tự MON..SUN; parse chấp nhận "MON" hoặc "MONDAY".

## Điểm lưu ý cho FRONTEND

1. **GymClassResponse**: `daysOfWeek` là `List<String>` (`["MON","WED","FRI"]`); `startTime`/`endTime` serialize dạng `"08:00:00"` (LocalTime → Jackson mặc định HH:mm:ss). Frontend nên cắt lấy HH:mm khi hiển thị.
2. **CreateClassRequest / UpdateClassRequest** gửi: `startTime`/`endTime` dạng `"HH:mm"` hoặc `"HH:mm:ss"` (LocalTime parse được cả hai). `daysOfWeek` = mảng `["MON","WED"]`. `capacity` phải > 0 (`@Positive`).
3. **available-for-class**: query params `days` (CSV hoặc lặp `days=MON&days=WED`), `startTime`, `endTime` (HH:mm). Trả `{ id, fullName }` với `id = trainer_profile.id` → dùng chính id này cho `trainerId` khi tạo lớp.
4. **Timetable**: `bookedCount = 0`, `availableSpots = capacity` (placeholder UC5.1). `dayOfWeek` = "MON".."SUN". Chỉ chứa session GROUP (gym_class_id != null). `week` param dạng `2026-W30`; thiếu → tuần hiện tại. Response có field `week` (label ISO đã chuẩn hóa).
5. **Validation lỗi thiếu trường**: trả **mảng** `ErrorResponse[]` (message "Trường này là bắt buộc"). Lỗi E-1/E-3/404: trả **object đơn** `{field?, message}`. Frontend cần xử lý cả 2 dạng.
6. **Permission**: cả ADMIN và RECEPTIONIST đều truy cập được (khác các endpoint trainer/equipment chỉ ADMIN).
7. Thời gian: nếu `endTime <= startTime` → 400 field=`endTime` "Giờ kết thúc phải sau giờ bắt đầu".
