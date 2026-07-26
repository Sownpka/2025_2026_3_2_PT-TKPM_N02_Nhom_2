# Spec UC4.1 — Quản lý lớp học

## Tổng quan
- **Tên:** Quản lý lớp học
- **Vai trò:** ADMIN + LỄ TÂN
- **Route:** `/admin/classes`
- **Giao diện tham chiếu:** Hình 46–52

---

## Luồng cơ bản

1. Admin/Lễ tân vào trang "Lớp học" → **Tab 1 (Danh sách)**: bảng lớp học; **Tab 2 (Thời khóa biểu)**: lưới tuần
2. Nhấn "+ Thêm lớp mới" → form nhập liệu
3. Điền Tên lớp(*), Loại thiết bị (dropdown), Huấn luyện viên(*), Ngày trong tuần(*) [chọn nhiều], Giờ bắt đầu(*), Giờ kết thúc(*), Sức chứa tối đa(*), Mô tả → nhấn "Lưu lớp học"
4. Backend kiểm tra hợp lệ → lưu `gym_class` + **auto-generate `class_session`** 8 tuần tới → toast thành công

---

## Luồng phụ & Luồng thay thế

### E-1 — Tên lớp đã tồn tại (Hình 48)
- Lỗi + highlight đỏ trường **Tên lớp**
- Message: **"Tên lớp học đã tồn tại"**

### E-2 — Thiếu trường bắt buộc (Hình 49)
- Highlight đỏ các trường trống (tên lớp, HLV, ngày, giờ bắt đầu, giờ kết thúc, sức chứa)
- Message: **"Trường này là bắt buộc"**

### E-3 — Khung giờ trùng buổi 1-1/1-2 của HLV (Hình 50) — ràng buộc cứng R4.8
- Khi backend phát hiện HLV đã có `class_session` type=PRIVATE_1_1 hoặc PRIVATE_1_2 trùng khung giờ + ngày trong tuần
- **Chặn lưu**, trả lỗi: **"Huấn luyện viên đã có buổi dạy 1-1/1-2 vào khung giờ này. Vui lòng chọn giờ khác hoặc đổi huấn luyện viên."**
- Thực hiện ở backend, không chỉ frontend

### S-1 — Sửa lớp học (Hình 51)
- Nhấn "Sửa" → form prefill → "Cập nhật"
- Khi cập nhật: xóa class_sessions cũ từ ngày hôm nay trở đi → re-generate mới (giữ lại sessions đã qua)

### S-2 — Thời khóa biểu theo tuần (Hình 52)
- Tab riêng: lưới 7 cột T2→CN, mỗi ô = card lớp: **tên lớp | HLV | số chỗ còn lại**
- Nút ← → chuyển tuần (ISO week param)
- **Số chỗ còn lại** = `class_session.capacity` (booking count sẽ tích hợp ở UC5.1)

### S-3 — Ngừng hoạt động (soft delete)
- Nhấn "Xóa" → confirm → `PATCH /api/classes/{id}/status` → `status = INACTIVE`
- **Xóa các class_sessions tương lai** (từ ngày mai trở đi) của lớp này để giải phóng lịch HLV

---

## Business Rules

1. **Auto-generate class_sessions:** khi tạo/cập nhật lịch gym_class, generate `class_session` cho **8 tuần tới** (từ thứ Hai của tuần hiện tại):
   - Với mỗi `day` trong `days_of_week`, tính các ngày cụ thể trong 8 tuần
   - `type = GROUP`, `capacity = gym_class.capacity`, `trainer_id = gym_class.trainer_id`
   - Khi update: xóa sessions từ ngày mai trở đi rồi re-generate mới
2. **E-3 kiểm tra ở backend (R4.8 — ràng buộc cứng):** với mỗi `day` trong `days_of_week`, check trong 8 tuần tới xem trainer có `class_session` type=PRIVATE với thời gian chồng lấn không
   - Chồng lấn: `NOT (requestedEnd <= session.startTime OR requestedStart >= session.endTime)`
3. **Gợi ý sức chứa:** khi chọn loại thiết bị, frontend gọi `GET /api/equipment/count-by-type` (từ UC4.2) để hiển thị gợi ý "Loại Reformer hiện có 8 máy"
4. **Trainer dropdown:** chỉ hiển thị HLV ACTIVE không có xung đột lịch GROUP cho khung giờ + ngày đã chọn (gọi `/api/trainers/available-for-class`)
5. **Soft delete:** đổi `status = INACTIVE`, đồng thời xóa class_sessions tương lai
6. **Audit log:** `CREATE_CLASS` / `UPDATE_CLASS` / `DEACTIVATE_CLASS`, entity = `"gym_class"`

---

## Trạng thái stub hiện tại (quan trọng — đọc kỹ)

V3 migration ĐÃ TẠO `gym_class` với đủ columns (name, equipment_type, trainer_id, days_of_week VARCHAR, start_time, end_time, capacity, description, status, created_at). **Không cần migration mới.**

GymClass entity stub THIẾU: `equipmentType`, `daysOfWeek`, `capacity`, `description` → phải thêm vào entity. Không cần ALTER TABLE.

ClassSession entity đã đủ field. ClassSessionRepository có 2 query cơ bản (sumMinutesInRange, findByTrainerIdAndSessionDateBetween) → cần thêm queries mới.

GymClassRepository là shell rỗng → thêm `findAllByStatusOrderByIdAsc`, `existsByName`, `existsByNameAndIdNot`.

**Không tạo Flyway migration mới** — schema đã đủ ở V3.

---

## API Endpoints

```
GET    /api/classes                       (ADMIN + RECEPTIONIST) — list ACTIVE classes
POST   /api/classes                       (ADMIN + RECEPTIONIST) — tạo lớp + generate sessions
PUT    /api/classes/{id}                  (ADMIN + RECEPTIONIST) — sửa lớp + re-generate sessions
PATCH  /api/classes/{id}/status           (ADMIN + RECEPTIONIST) — soft delete + xóa future sessions
GET    /api/timetable?week=YYYY-Www       (ADMIN + RECEPTIONIST) — lưới tuần từ class_session
GET    /api/trainers/available-for-class?days=MON,WED&startTime=08:00&endTime=10:00
                                          (ADMIN + RECEPTIONIST) — HLV không có xung đột lịch
```

### GET /api/classes — Response
```json
[
  {
    "id": 1,
    "name": "Lớp Reformer sáng",
    "equipmentType": "Reformer",
    "trainerId": 1,
    "trainerName": "Nguyễn Thị B",
    "daysOfWeek": ["MON", "WED", "FRI"],
    "startTime": "08:00",
    "endTime": "10:00",
    "capacity": 8,
    "description": "",
    "status": "ACTIVE"
  }
]
```

### POST /api/classes — Request
```json
{
  "name": "Lớp Reformer sáng",
  "equipmentType": "Reformer",
  "trainerId": 1,
  "daysOfWeek": ["MON", "WED", "FRI"],
  "startTime": "08:00",
  "endTime": "10:00",
  "capacity": 8,
  "description": ""
}
```

### GET /api/timetable?week=2026-W30 — Response
```json
{
  "week": "2026-W30",
  "sessions": [
    {
      "sessionId": 10,
      "gymClassId": 1,
      "className": "Lớp Reformer sáng",
      "trainerName": "Nguyễn Thị B",
      "sessionDate": "2026-07-20",
      "dayOfWeek": "MON",
      "startTime": "08:00",
      "endTime": "10:00",
      "capacity": 8,
      "bookedCount": 0,
      "availableSpots": 8
    }
  ]
}
```
*(bookedCount = 0 vì booking table chưa có, UC5.1 sẽ cập nhật)*

### GET /api/trainers/available-for-class — Response
```json
[
  { "id": 1, "fullName": "Nguyễn Thị B" }
]
```
*(id = trainer_profile.id, không phải user_account.id)*

### Error responses (tiếng Việt đúng nguyên văn)
```json
{ "field": "name",      "message": "Tên lớp học đã tồn tại" }
{ "field": "trainerId", "message": "Huấn luyện viên đã có buổi dạy 1-1/1-2 vào khung giờ này. Vui lòng chọn giờ khác hoặc đổi huấn luyện viên." }
{ "field": "name",      "message": "Trường này là bắt buộc" }
```

---

## Data Model (không đổi — V3 đã đủ)

```
gym_class: id, name UQ, equipment_type VARCHAR, trainer_id FK trainer_profile, days_of_week VARCHAR(50 — CSV), start_time, end_time, capacity, description TEXT, status ACTIVE/INACTIVE, created_at
class_session: id, gym_class_id FK (NULL cho 1-1/1-2), trainer_id FK, session_date, start_time, end_time, type GROUP/PRIVATE_1_1/PRIVATE_1_2, capacity, created_at
```

---

## UI/UX (CLAUDE.md mục 6)

### Tab 1 — Danh sách lớp
- Header: **"Quản lý Lớp học"**, badge vai trò góc phải
- Nút "+ Thêm lớp mới" teal, góc trên phải
- Cột bảng: **Tên lớp | Loại thiết bị | Huấn luyện viên | Lịch học | Giờ | Sức chứa | Trạng thái | Thao tác**
  - "Lịch học": hiển thị pills nhỏ T2/T3/T4/T5/T6/T7/CN (chỉ các ngày có trong daysOfWeek)
  - "Giờ": "08:00 – 10:00"
  - Thao tác: **"Sửa"** (cam) + **"Xóa"** (đỏ)

### Tab 2 — Thời khóa biểu
- Nhãn tuần: "Tuần dd/mm – dd/mm", nút ← →
- 7 cột T2→CN
- Mỗi card: tên lớp (bold), HLV, "8 chỗ" (capacity)
- Ô trống = không có lớp hôm đó

### Form thêm/sửa (modal)
- Tên lớp(*) — text input
- Loại thiết bị — text input (khi nhập xong / blur → gọi count-by-type để hiển thị gợi ý "Hiện có N máy loại này")
- **Huấn luyện viên(*)** — dropdown; **chỉ enable khi đã chọn ngày + giờ** (cần có để gọi /available-for-class); gọi lại mỗi khi ngày hoặc giờ thay đổi
- Ngày trong tuần(*) — checkboxes T2/T3/T4/T5/T6/T7/CN (map sang MON..SUN khi gửi)
- Giờ bắt đầu(*) + Giờ kết thúc(*) — time input (HH:mm)
- Sức chứa tối đa(*) — number input
- Mô tả — textarea
- Nút "Lưu lớp học" / "Cập nhật lớp học"

### Confirm xóa
- "Bạn có chắc muốn ngừng lớp học này? Tất cả lịch tập tương lai của lớp sẽ bị hủy."

### Toast
- "Thêm lớp học thành công!"
- "Cập nhật lớp học thành công!"
- "Đã ngừng hoạt động lớp học."

---

## Files Backend cần tạo/sửa

```
com/picore/clazz/
├── GymClass.java                 (MỞ RỘNG — thêm field equipmentType, daysOfWeek, capacity, description)
├── GymClassRepository.java       (MỞ RỘNG — thêm findAllByStatus, existsByName, existsByNameAndIdNot)
├── GymClassService.java          (TẠO MỚI — full CRUD + auto-generate sessions + E-3 check + audit log)
├── GymClassController.java       (TẠO MỚI — @PreAuthorize ADMIN or RECEPTIONIST)
└── dto/
    ├── CreateClassRequest.java   (record: name, equipmentType, trainerId, daysOfWeek, startTime, endTime, capacity, description)
    ├── UpdateClassRequest.java   (record: name, equipmentType, trainerId, daysOfWeek, startTime, endTime, capacity, description)
    ├── GymClassResponse.java     (record: id, name, equipmentType, trainerId, trainerName, daysOfWeek, startTime, endTime, capacity, description, status)
    ├── TimetableResponse.java    (record: week, List<TimetableSession> sessions)
    └── TimetableSession.java     (record: sessionId, gymClassId, className, trainerName, sessionDate, dayOfWeek, startTime, endTime, capacity, bookedCount, availableSpots)

ClassSessionRepository.java      (MỞ RỘNG — thêm queries cho timetable + E-3 + cleanup future sessions)
TrainerController.java            (THÊM endpoint GET /trainers/available-for-class)
TrainerService.java               (THÊM method getAvailableForClass)
```

Pattern tham chiếu: `com/picore/equipment/` và `com/picore/trainer/`

---

## Files Frontend cần tạo/sửa

```
src/pages/admin/AdminClassesPage.tsx   (TẠO MỚI — 2 tab: danh sách + thời khóa biểu)
src/api/classes.ts                      (TẠO MỚI — getClasses, createClass, updateClass, deactivateClass, getTimetable)
src/types/class.ts                      (TẠO MỚI — GymClassResponse, CreateClassRequest, TimetableResponse, TimetableSession, AvailableTrainer)
```

Sửa:
- `App.tsx` — thay Placeholder `/admin/classes` bằng `AdminClassesPage` thật
- `api/trainers.ts` — thêm `getAvailableForClass(days, startTime, endTime)`

Sidebar ADMIN đã có "Lớp học" đúng vị trí — không cần sửa.

---

## Lưu ý kỹ thuật

1. **days_of_week lưu dạng CSV** trong DB (đã quyết định ở V3): "MON,WED,FRI". Service cần serialize/deserialize với `Arrays.asList(str.split(","))`.
2. **generate_sessions logic:**
   ```
   Thứ Hai của tuần hiện tại → 8 tuần (56 ngày)
   Với mỗi ngày trong range: nếu dayOfWeek match → tạo ClassSession
   ```
3. **E-3 check:** query ClassSession type IN (PRIVATE_1_1, PRIVATE_1_2) WHERE trainer_id=X AND session_date in next 8 weeks AND day-of-week in requested days AND time overlaps
4. **TrainerResponse trong GymClassResponse:** join với trainer_profile + user_account để lấy fullName
5. **bookedCount trong timetable:** LEFT JOIN booking WHERE status != CANCELLED (booking table chưa có → bookedCount = 0, hard-code hoặc query với COALESCE 0)
6. **@PreAuthorize:** `hasAnyRole('ADMIN','RECEPTIONIST')` cho các endpoint classes/timetable
7. **Trainer available-for-class endpoint:** đặt trong TrainerController (không tạo endpoint mới trong ClassController) để tránh circular dependency
