# Spec UC4.3 — Quản lý huấn luyện viên

## Tổng quan
- **Tên:** Quản lý huấn luyện viên
- **Vai trò:** ADMIN
- **Route:** `/admin/trainers`
- **Giao diện tham chiếu:** Hình 56–57

---

## Luồng cơ bản

1. Admin vào trang "Huấn luyện viên" → hệ thống hiển thị danh sách HLV kèm cột **"Tổng giờ dạy tuần này"** (tự động tổng hợp từ `class_session`)
2. Admin nhấn **"+ Thêm HLV"** → dropdown chọn từ danh sách tài khoản có `role = TRAINER` chưa có hồ sơ HLV
3. Admin điền hồ sơ: Chuyên môn, SĐT liên hệ → nhấn "Lưu"
4. Hệ thống lưu `trainer_profile` → toast thành công, cập nhật danh sách

---

## Luồng phụ & Luồng thay thế

### S-1 — Xem ca làm việc theo tuần (Hình 57)
- Nhấn "Xem lịch" trên hàng HLV → mở modal/trang lưới tuần
- Lưới: 7 cột T2→CN, mỗi ô hiển thị khung giờ đã có lớp/buổi 1-1/1-2 của HLV đó
- Nút ← → chuyển tuần để đối chiếu khối lượng
- **⚠ Ca làm việc là dữ liệu dẫn xuất (derived data)** — query tổng hợp từ `class_session` theo `trainer_id + tuần`. **KHÔNG có form khai báo thủ công. Không tạo bảng `work_shift`.**
- Tuần trống → "Chưa có lịch dạy trong tuần này."

### S-2 — Sửa hồ sơ HLV
- Nhấn "Sửa" → form prefill chuyên môn, SĐT liên hệ → "Cập nhật" → toast thành công

### S-3 — Ngừng hoạt động (soft delete)
- Nhấn "Xóa" → hộp thoại xác nhận → `PATCH /api/trainers/{id}/status` → `status = INACTIVE`
- HLV INACTIVE: ẩn khỏi dropdown gán lớp mới (UC4.1), lớp đã gán **không đổi**

### E-1 — Không còn tài khoản TRAINER để thêm
- Tất cả tài khoản TRAINER đã có hồ sơ → thông báo "Không còn tài khoản huấn luyện viên chưa được tạo hồ sơ. Vui lòng thêm tài khoản mới ở mục Tài khoản trước."

---

## Business Rules

1. **Thêm HLV = gắn hồ sơ vào tài khoản** — dropdown chỉ hiển thị `user_account` có `role = TRAINER` và chưa có `trainer_profile` (tức `trainer_profile.user_account_id` chưa tồn tại)
2. **Ca làm việc = derived data** từ `class_session` WHERE `trainer_id = X` AND `session_date` thuộc tuần được chọn. **Không có bảng `work_shift`.**
3. **Tổng giờ dạy tuần này** = SUM của `(end_time - start_time)` từng `class_session` của HLV trong tuần hiện tại (T2–CN), trả về dạng `"X giờ Y phút"` hoặc số phút
4. **Soft delete**: đổi `status = INACTIVE`, lớp đã gán không đổi
5. **Audit log**: `CREATE_TRAINER_PROFILE` / `UPDATE_TRAINER_PROFILE` / `DEACTIVATE_TRAINER`, entity = `"trainer_profile"`
6. Tạo thêm 2 bảng stub trong cùng migration V3 để shifts query có thể compile và trả empty: `gym_class`, `class_session` (UC4.1 sẽ populate, không cần thêm cột)

---

## Data Model

```sql
-- V3 migration: tạo 3 bảng
trainer_profile(
  id               BIGINT AUTO_INCREMENT PK,
  user_account_id  BIGINT NOT NULL UNIQUE FK → user_account(id),
  specialty        VARCHAR(200),        -- Chuyên môn
  contact_phone    VARCHAR(20),         -- SĐT liên hệ
  status           ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)

-- Stub tables cho shifts query (UC4.1 sẽ populate):
gym_class(
  id              BIGINT AUTO_INCREMENT PK,
  name            VARCHAR(100) NOT NULL UNIQUE,
  equipment_type  VARCHAR(100),
  trainer_id      BIGINT FK → trainer_profile(id),
  days_of_week    SET('MON','TUE','WED','THU','FRI','SAT','SUN') NOT NULL DEFAULT '',
  start_time      TIME NOT NULL DEFAULT '00:00:00',
  end_time        TIME NOT NULL DEFAULT '00:00:00',
  capacity        INT NOT NULL DEFAULT 0,
  description     TEXT,
  status          ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)

class_session(
  id              BIGINT AUTO_INCREMENT PK,
  gym_class_id    BIGINT FK → gym_class(id),       -- NULL cho buổi 1-1/1-2
  trainer_id      BIGINT NOT NULL FK → trainer_profile(id),
  session_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  type            ENUM('GROUP','PRIVATE_1_1','PRIVATE_1_2') NOT NULL DEFAULT 'GROUP',
  capacity        INT NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

Flyway migration: **V3__create_trainer_and_class_tables.sql**

---

## API Endpoints

```
GET    /api/trainers                     (ADMIN) — danh sách HLV ACTIVE, kèm totalHoursThisWeek
GET    /api/trainers/available-accounts  (ADMIN) — user_account role=TRAINER chưa có trainer_profile
POST   /api/trainers                     (ADMIN) — tạo trainer_profile (body: userAccountId, specialty, contactPhone)
PUT    /api/trainers/{id}                (ADMIN) — sửa hồ sơ (specialty, contactPhone)
PATCH  /api/trainers/{id}/status         (ADMIN) — soft delete → INACTIVE
GET    /api/trainers/{id}/shifts?week=YYYY-Www (ADMIN) — lưới ca tuần dẫn xuất từ class_session
```

### GET /api/trainers — Response
```json
[
  {
    "id": 1,
    "userAccountId": 5,
    "fullName": "Nguyễn Thị B",
    "email": "trainer1@picore.vn",
    "specialty": "Pilates cơ bản, Reformer",
    "contactPhone": "0912345678",
    "status": "ACTIVE",
    "totalMinutesThisWeek": 180
  }
]
```
*(Frontend tự format `totalMinutesThisWeek` → "3 giờ 0 phút")*

### GET /api/trainers/available-accounts — Response
```json
[
  { "id": 5, "fullName": "Nguyễn Thị B", "email": "trainer1@picore.vn" }
]
```

### POST /api/trainers — Request
```json
{
  "userAccountId": 5,
  "specialty": "Pilates cơ bản, Reformer",
  "contactPhone": "0912345678"
}
```

### GET /api/trainers/{id}/shifts?week=2026-W29 — Response
```json
{
  "week": "2026-W29",
  "sessions": [
    {
      "sessionId": 10,
      "sessionDate": "2026-07-20",
      "dayOfWeek": "MON",
      "startTime": "08:00",
      "endTime": "10:00",
      "type": "GROUP",
      "className": "Lớp Reformer sáng",
      "durationMinutes": 120
    }
  ]
}
```
*(Empty sessions = [] khi tuần chưa có lịch)*

### Error responses (tiếng Việt đúng nguyên văn)
```json
{ "field": "userAccountId", "message": "Tài khoản không tồn tại hoặc không phải huấn luyện viên" }
{ "field": "userAccountId", "message": "Tài khoản này đã có hồ sơ huấn luyện viên" }
```

---

## UI/UX (CLAUDE.md mục 6)

- **Layout:** sidebar teal + header trắng **"Quản lý Huấn luyện viên"**, badge "Admin – …"
- **Bảng:** cột **Họ tên | Email | Chuyên môn | SĐT liên hệ | Tổng giờ dạy tuần này | Trạng thái | Thao tác**
  - "Tổng giờ dạy tuần này" hiển thị dạng "X giờ Y phút" (format từ `totalMinutesThisWeek`)
  - Trạng thái: pill xanh "Hoạt động" / pill đỏ "Ngừng hoạt động"
- **Nút "+ Thêm HLV":** teal solid, góc trên phải
- **Thao tác:** **"Xem lịch"** (xanh dương `#3B82F6`) + **"Sửa"** (cam) + **"Xóa"** (đỏ)
- **Form thêm HLV (modal):**
  - Dropdown "Chọn tài khoản HLV" (lấy từ `/api/trainers/available-accounts`)
  - Input "Chuyên môn", Input "SĐT liên hệ"
  - Nút "Lưu"
- **Lưới ca làm việc (S-1) — modal overlay:**
  - 7 cột T2→CN, nhãn tuần "Tuần dd/mm – dd/mm"
  - Nút ← → chuyển tuần (param `?week=YYYY-Www`)
  - Mỗi ô ca = card nhỏ: tên lớp / "Buổi 1-1" / "Buổi 1-2" + giờ bắt đầu–kết thúc
  - Ô trống = không có lịch
  - Khi sessions = [] → "Chưa có lịch dạy trong tuần này."
- **Toast thành công:** "Thêm hồ sơ huấn luyện viên thành công!" / "Cập nhật thành công!" / "Đã ngừng hoạt động huấn luyện viên."
- **Confirm dialog xóa:** "Bạn có chắc muốn ngừng hoạt động huấn luyện viên này?"

---

## Files Backend cần tạo

```
com/picore/trainer/
├── TrainerProfile.java              (Entity JPA)
├── TrainerRepository.java           (findAllActive, existsByUserAccountId, ...)
├── TrainerService.java              (@Transactional + audit log)
├── TrainerController.java           (@PreAuthorize ADMIN)
└── dto/
    ├── CreateTrainerRequest.java    (record: userAccountId, specialty, contactPhone)
    ├── UpdateTrainerRequest.java    (record: specialty, contactPhone)
    ├── TrainerResponse.java         (record: id, userAccountId, fullName, email, specialty, contactPhone, status, totalMinutesThisWeek)
    ├── AvailableAccountResponse.java (record: id, fullName, email)
    └── TrainerShiftsResponse.java   (record: week, List<ShiftSession> sessions)
    └── ShiftSession.java            (record: sessionId, sessionDate, dayOfWeek, startTime, endTime, type, className, durationMinutes)

com/picore/clazz/                    (stub — UC4.1 sẽ implement đầy đủ)
├── GymClass.java                    (Entity stub — chỉ cần compile, trainer_id FK)
└── GymClassRepository.java          (minimal — chỉ để TrainerService không bị compile error)

com/picore/clazz/ClassSession.java   (Entity stub cho shifts query)

db/migration/V3__create_trainer_and_class_tables.sql
```

Pattern tham chiếu: `com/picore/equipment/` (Entity + Repo + Service + Controller + record DTOs, không Lombok)

---

## Files Frontend cần tạo

```
src/pages/admin/AdminTrainersPage.tsx   (page chính: bảng + modal thêm/sửa + lưới lịch + confirm + toast)
src/api/trainers.ts                      (axios: getTrainers, getAvailableAccounts, createTrainer, updateTrainer, deactivateTrainer, getShifts)
src/types/trainer.ts                     (TrainerResponse, CreateTrainerRequest, UpdateTrainerRequest, AvailableAccountResponse, TrainerShiftsResponse, ShiftSession)
```

## Files Frontend cần SỬA

1. `src/App.tsx` — thay Placeholder route `/admin/trainers` bằng `AdminTrainersPage` thật
2. `src/components/Sidebar.tsx` — thêm **"Huấn luyện viên"** vào ADMIN menu (path: `/admin/trainers`), đặt sau "Thiết bị", trước "Tài chính"

---

## Lưu ý kỹ thuật

- **Week format:** ISO 8601 `YYYY-Www` (vd: `2026-W29`). Backend parse bằng `java.time.IsoFields.WEEK_OF_WEEK_BASED_YEAR` hoặc `YearWeek` từ `java.time`. Tuần mặc định = tuần hiện tại nếu không truyền `week` param.
- **totalMinutesThisWeek**: tính bằng JPQL/native query tổng `TIMESTAMPDIFF(MINUTE, start_time, end_time)` từ `class_session` WHERE `trainer_id = X` AND `session_date` trong tuần hiện tại. Trả 0 nếu chưa có session.
- **GymClass + ClassSession là stub**: chỉ cần Entity + Repository minimal để `TrainerService` compile shifts query. UC4.1 sẽ implement đầy đủ Controller/Service cho các entity này.
- Seed data: CLAUDE.md mục 9 có 3 HLV → thêm seed vào V3 migration sau khi tạo `trainer_profile`
