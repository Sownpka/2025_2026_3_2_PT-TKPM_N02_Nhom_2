# Spec UC3.2 — Đăng ký & Gia hạn Gói tập

## Tổng quan
- **Tên:** Đăng ký & gia hạn gói tập
- **Vai trò:** RECEPTIONIST
- **Route:** `/reception/register-package`
- **Giao diện tham chiếu:** Hình 40–45

---

## Luồng cơ bản (Hình 40)

1. Lễ tân nhập tên hoặc SĐT hội viên vào ô tìm kiếm → nhấn "Tìm"
2. Hệ thống hiển thị card thông tin hội viên (họ tên, SĐT, email, trạng thái gói hiện tại)
3. Lễ tân chọn loại gói từ dropdown (chỉ hiện gói `status = ACTIVE`)
4. Hệ thống **tự động điền**: số buổi (từ `package_type.sessions`), tự tính `ngày hết hạn = ngày bắt đầu + package_type.duration_days`
5. Lễ tân nhấn **"Xác nhận đăng ký"**
6. Backend kiểm tra hợp lệ, lưu `member_package`, ghi `package_transaction`
7. Toast thành công (Hình 45)

---

## Luồng phụ & Luồng thay thế

### S-1 — Không tìm thấy hội viên (Hình 41, 42)
- Hệ thống báo "Không tìm thấy hội viên" + nút **"Tạo hội viên mới"**
- Nhấn nút → mở form tạo hội viên (như UC2.1)
- Sau khi tạo xong → **tự điền lại hội viên mới vào form đăng ký gói**

### S-2 — Gia hạn (hội viên đã có gói còn hiệu lực) (Hình 43, 44)
- Nếu hội viên đang có `member_package.status = ACTIVE` → hiển thị **cảnh báo vàng** kèm thông tin gói hiện tại
- Nếu lễ tân tiếp tục xác nhận → tạo gói mới với **`start_date = end_date gói cũ + 1 ngày`**

### S-3 — Gói 1-1/1-2
- Lưu `member_package` như thường (không gán HLV/ca tại bước này)
- Sau khi lưu thành công, hiển thị thêm thông báo: **"Hội viên cần tự đăng ký lịch tập hằng tuần qua chức năng Đặt buổi 1-1/1-2 trước hạn chót."**

---

## Business Rules bắt buộc

1. **`package_transaction` BẮT BUỘC** — mỗi lần đăng ký/gia hạn thành công phải ghi 1 bản ghi:
   - `amount` = `package_type.price` tại thời điểm mua (snapshot, không theo giá hiện tại)
   - `type` = `NEW` nếu hội viên chưa có gói hiệu lực / `RENEWAL` nếu gia hạn
   - Đây là **nguồn dữ liệu doanh thu** cho UC6.1
2. **Gia hạn:** `start_date = end_date_cũ + 1 ngày` — không tính theo ngày thực hiện giao dịch
3. **Gói THEO_BUOI / GOI_1_1 / GOI_1_2:** `sessions_remaining = package_type.sessions`
4. **Gói THEO_THANG / KHONG_GIOI_HAN:** `sessions_remaining = NULL` (unlimited)
5. **`audit_log`** phải ghi khi bán/gia hạn gói: `action = "SELL_PACKAGE"`, `entity = "member_package"`, `entity_id = <id mới>`, `detail` = tên gói + tên hội viên + số tiền
6. **Cảnh báo gói sắp hết (R3.4):** hiển thị badge/banner khi gói hiện tại ≤ 2 buổi hoặc ≤ 7 ngày hết hạn (trong card hội viên)

---

## Data Model liên quan

```sql
member_package(
  id, member_id FK, package_type_id FK,
  start_date DATE, end_date DATE,
  sessions_remaining INT NULL,    -- NULL = unlimited
  status ENUM(ACTIVE, EXPIRED, USED_UP),
  created_at
)

package_transaction(
  id,
  member_package_id FK,
  member_id FK,
  amount DECIMAL(12,0),           -- snapshot giá tại thời điểm mua
  type ENUM(NEW, RENEWAL),
  created_at
)
```

Bảng `package_type` đã có từ UC3.1:
```sql
package_type(id, name, category ENUM(THEO_BUOI,THEO_THANG,KHONG_GIOI_HAN,GOI_1_1,GOI_1_2),
             sessions INT NULL, duration_days, price, description, status)
```

---

## API Endpoints

```
POST   /api/member-packages          (RECEPTIONIST) — đăng ký gói, đồng thời ghi package_transaction
GET    /api/members/{id}/packages    (RECEPTIONIST) — danh sách gói của hội viên (kèm trạng thái)
GET    /api/members/search?q=        (RECEPTIONIST) — tìm hội viên theo tên hoặc SĐT
```

### POST /api/member-packages — Request
```json
{
  "memberId": 1,
  "packageTypeId": 3,
  "startDate": "2026-07-18"    // ISO date, lễ tân xác nhận hoặc tự động = today
}
```

### POST /api/member-packages — Response (201)
```json
{
  "id": 10,
  "memberId": 1,
  "memberName": "Nguyễn Thị A",
  "packageTypeName": "Gói 12 buổi",
  "packageCategory": "THEO_BUOI",
  "startDate": "2026-07-18",
  "endDate": "2026-09-15",
  "sessionsRemaining": 12,
  "status": "ACTIVE",
  "type": "NEW",                // hoặc "RENEWAL"
  "amountPaid": 1500000,
  "isPrivatePackage": false     // true nếu GOI_1_1 hoặc GOI_1_2
}
```

### GET /api/members/{id}/packages — Response
```json
[
  {
    "id": 10,
    "packageTypeName": "Gói 12 buổi",
    "packageCategory": "THEO_BUOI",
    "startDate": "2026-07-18",
    "endDate": "2026-09-15",
    "sessionsRemaining": 12,
    "status": "ACTIVE",
    "warningSessions": false,   // true nếu ≤ 2 buổi còn lại
    "warningExpiry": false      // true nếu ≤ 7 ngày hết hạn
  }
]
```

### Error responses (tiếng Việt đúng nguyên văn)
```json
{ "field": "memberId",     "message": "Không tìm thấy hội viên" }
{ "field": "packageTypeId","message": "Loại gói tập không tồn tại hoặc ngừng áp dụng" }
{ "field": "startDate",    "message": "Ngày bắt đầu không hợp lệ" }
```

---

## UI/UX (CLAUDE.md mục 6)

- **Bố cục trang:** sidebar teal + header trắng "Đăng ký Gói tập" (route RECEPTIONIST)
- **Tìm kiếm hội viên:** ô input + nút "Tìm" → hiển thị card xanh nhạt kết quả
- **Card hội viên:** họ tên (bold), SĐT, email; nếu có gói hiện tại: tên gói + số buổi còn lại + ngày hết hạn
  - Badge cam `⚠ Sắp hết buổi` nếu ≤ 2 buổi
  - Badge vàng `⚠ Sắp hết hạn` nếu ≤ 7 ngày
- **Cảnh báo gia hạn (S-2):** banner vàng "Hội viên đang có gói còn hiệu lực. Bạn có chắc muốn đăng ký thêm không?"
- **Dropdown gói:** chỉ hiện `package_type.status = ACTIVE`; chọn xong → auto-fill số buổi và ngày hết hạn (read-only)
- **Nút "Xác nhận đăng ký":** teal solid, full-width
- **Tiền hiển thị:** `Intl.NumberFormat('vi-VN')` → `1.500.000 ₫`
- **Toast thành công:** xanh lá góc phải — "Đăng ký gói tập thành công!"

---

## Files Backend cần tạo/sửa

```
com/picore/memberpackage/
├── MemberPackage.java               (Entity)
├── MemberPackageRepository.java
├── PackageTransaction.java          (Entity)
├── PackageTransactionRepository.java
├── MemberPackageService.java        (logic chính: @Transactional, audit_log, package_transaction)
├── MemberPackageController.java     (@PreAuthorize RECEPTIONIST)
└── dto/
    ├── RegisterPackageRequest.java  (record)
    └── MemberPackageResponse.java   (record)
```

Sửa `member/MemberController.java` nếu cần thêm endpoint `/members/search?q=`

Migration Flyway mới: `V{N}__create_member_package_tables.sql`

---

## Files Frontend cần tạo

```
src/pages/reception/RegisterPackagePage.tsx   (page chính)
src/api/memberPackage.ts                       (axios functions)
src/stores/memberPackageStore.ts               (Zustand store)
src/types/memberPackage.ts                     (TypeScript interfaces)
```

Thêm route `/reception/register-package` vào router (RECEPTIONIST only).  
Thêm menu item "Đăng ký gói tập" vào Sidebar cho RECEPTIONIST.
