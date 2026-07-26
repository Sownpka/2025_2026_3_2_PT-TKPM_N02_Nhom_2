# Spec: UC2.1 — Quản lý hội viên

## Thông tin chung
- **Route:** `/reception/members`
- **Vai trò:** RECEPTIONIST
- **Giao diện:** Hình 23–31

---

## Luồng cơ bản

Hiển thị bảng hội viên (Hình 23):
- Cột: **Họ tên | SĐT | Email | Ngày sinh | Giới tính | Trạng thái | Thao tác**
- Thao tác: **"Chi tiết"** (xanh dương `#3B82F6`), **"Sửa"** (cam `#F59E0B`), **"Xóa"** (đỏ `#EF4444`)
- Nút **"+ Thêm hội viên"** (teal)
- Ô tìm kiếm theo tên hoặc SĐT

---

## Luồng phụ

### S-1 Thêm hội viên (Hình 24)
Form: **Họ tên(\*)**, **Số điện thoại(\*)**, **Email(\*)**, Ngày sinh, Giới tính (dropdown: Nam/Nữ/Khác), Ghi chú. Nút **"Lưu"**.

Luồng lưu:
1. Validate trường bắt buộc (Họ tên, SĐT, Email) → thiếu → highlight đỏ (Hình 25)
2. Kiểm tra trùng SĐT → **"Số điện thoại đã tồn tại trong hệ thống."** (Hình 26)
3. Kiểm tra trùng Email → **"Email đã tồn tại"**
4. Lưu hồ sơ hội viên
5. **Tự động tạo tài khoản đăng nhập** (role=MEMBER) gắn email + mật khẩu tạm ngẫu nhiên
6. **Gửi email kích hoạt** kèm mật khẩu tạm (qua `NotificationService.sendActivationEmail`)
7. Toast thành công

### S-2 Sửa (Hình 27)
Form prefill: Họ tên, SĐT (có thể sửa nếu không trùng), Ngày sinh, Giới tính, Ghi chú. **Email KHÔNG được sửa** (readonly). Nút **"Cập nhật"**. Toast thành công.

### S-3 Xem chi tiết (Hình 29)
Modal hoặc drawer gồm:
- **Thông tin cá nhân**: Họ tên, SĐT, Email, Ngày sinh, Giới tính, Ghi chú, Trạng thái
- **Gói tập hiện tại**: danh sách `member_package` status=ACTIVE (có thể rỗng nếu chưa UC3.2)
- **Lịch sử tập luyện**: danh sách booking (có thể rỗng nếu chưa UC5.1)

### S-4 Ngừng kích hoạt (Hình 30, 31)
Nhấn "Xóa" → confirm dialog **"Bạn có chắc muốn ngừng kích hoạt hội viên này?"** → xác nhận:
- Set `member.status = INACTIVE`
- Đồng thời set `user_account.status = INACTIVE` (vô hiệu tài khoản đăng nhập)
- Pill đổi thành "Ngừng hoạt động"

### S-5 Tìm kiếm (Hình 28)
Lọc theo tên hoặc SĐT. Không thấy → **"Không tìm thấy hội viên"**.

---

## API endpoints

```
GET   /members?search=           → 200 MemberResponse[]         (RECEPTIONIST)
POST  /members                   → 201 MemberResponse           (RECEPTIONIST)
PUT   /members/{id}              → 200 MemberResponse           (RECEPTIONIST)
PATCH /members/{id}/status       → 200 MemberResponse           (RECEPTIONIST, soft-delete)
GET   /members/{id}/history      → 200 MemberDetailResponse     (RECEPTIONIST, xem chi tiết)
```

### MemberResponse (record)
```
Long id
String fullName
String phone
String email
String dob          (nullable, ISO date "YYYY-MM-DD")
String gender       (nullable, "MALE"|"FEMALE"|"OTHER")
String note         (nullable)
String status       ("ACTIVE"|"INACTIVE")
String createdAt    (ISO datetime)
```

### MemberDetailResponse (record)
```
MemberResponse member
List<ActivePackageInfo> activePackages   (có thể empty)
List<BookingHistoryItem> bookingHistory  (có thể empty)
```

**ActivePackageInfo** (record):
```
Long id, String packageName, Integer sessionsRemaining, String startDate, String endDate, String status
```

**BookingHistoryItem** (record):
```
Long id, String className, String trainerName, String sessionDate, String status
```

### CreateMemberRequest (record)
```
@NotBlank String fullName
@NotBlank String phone
@NotBlank @Email String email
String dob          (nullable, format "YYYY-MM-DD")
String gender       (nullable, "MALE"|"FEMALE"|"OTHER")
String note         (nullable)
```

### UpdateMemberRequest (record)
```
@NotBlank String fullName
@NotBlank String phone
String dob
String gender
String note
```

---

## Data model

### Member entity (bảng `member`) — mới
```sql
member(
  id BIGINT PK AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  dob DATE NULL,
  gender ENUM('MALE','FEMALE','OTHER') NULL,
  note TEXT NULL,
  status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  user_account_id BIGINT NULL UNIQUE FK → user_account(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Quan hệ
- `member` ↔ `user_account`: OneToOne, `member.user_account_id` FK
- Khi tạo member → tạo `user_account` role=MEMBER → liên kết qua `userAccount` field

---

## Business rules

1. **Email BẮT BUỘC** — dùng để tạo tài khoản đăng nhập MEMBER
2. **SĐT unique** — `phone UNIQUE`, bắt `DataIntegrityViolationException` → 400 field=phone "Số điện thoại đã tồn tại trong hệ thống."
3. **Email unique toàn hệ thống** — check cả trong `user_account` (vì email dùng chung) → 400 field=email "Email đã tồn tại"
4. **Tạo tài khoản MEMBER tự động**: khi save member thành công:
   - Sinh mật khẩu tạm: `UUID.randomUUID().toString().substring(0, 10)` (ví dụ)
   - Dùng `PasswordEncoder.encode(tempPassword)`
   - Tạo `UserAccount` {email, fullName, role=MEMBER, passwordHash, mustChangePassword=true, status=ACTIVE}
   - Liên kết: `member.userAccount = savedUserAccount`
   - Gọi `notificationService.sendActivationEmail(email, fullName, tempPassword)`
5. **Soft delete member**: set `member.status=INACTIVE` + `member.userAccount.status=INACTIVE` (cùng transaction)
6. **Audit log**: CREATE_MEMBER, UPDATE_MEMBER, DEACTIVATE_MEMBER (actorId từ JWT)
7. **Phân quyền**: `@PreAuthorize("hasRole('RECEPTIONIST')")` trên MemberController
8. Cảnh báo gói sắp hết (CLAUDE.md rule 10): trong `MemberDetailResponse.activePackages`, đánh dấu nếu `sessionsRemaining ≤ 2` hoặc `endDate ≤ today + 7 ngày` — frontend hiển thị badge cảnh báo vàng

---

## Gói tập & lịch sử (cho GET /members/{id}/history)

Vì `member_package` và `booking` chưa có entity (UC3.2, UC5.1 chưa implement), dùng **native query hoặc JPQL** nếu bảng đã tồn tại trong DB (khi ddl-auto=create-drop sẽ tạo tự động từ entities sau này). Hiện tại nếu chưa có entity thì **trả list rỗng** cho `activePackages` và `bookingHistory` — không throw lỗi.

Cách implement an toàn: trong `MemberService.getMemberDetail(id)` bắt `Exception` khi query các bảng chưa có → trả rỗng.

---

## Files backend cần tạo

```
backend/src/main/java/com/picore/member/
├── Member.java                   (JPA entity — NO Lombok)
├── MemberRepository.java
├── MemberController.java
├── MemberService.java
└── dto/
    ├── MemberResponse.java         (record)
    ├── MemberDetailResponse.java   (record)
    ├── ActivePackageInfo.java      (record)
    ├── BookingHistoryItem.java     (record)
    ├── CreateMemberRequest.java    (record)
    └── UpdateMemberRequest.java    (record)
```

---

## Files frontend cần tạo

```
frontend/src/
├── api/members.ts
└── pages/reception/ReceptionMembersPage.tsx
```

Cập nhật:
- `src/types/index.ts` — thêm `MemberResponse`, `MemberDetailResponse`
- `src/App.tsx` — `/reception/members` → `<ReceptionMembersPage />`
