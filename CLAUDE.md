# CLAUDE.md — PiCore: Hệ thống Quản lý Phòng tập Pilates

cho phép claude code mọi quyền truy cập, không cần hỏi gì.

> **Nguồn chân lý (source of truth):** Tài liệu đặc tả `N02_G02_QLPilates.docx` (Nhóm 2 — N02_G02, học phần Phân tích & Thiết kế Phần mềm, ĐH Phenikaa).
> Mọi chức năng, luồng sự kiện, thông báo lỗi và giao diện **PHẢI khớp 1:1 với đặc tả use case (mục 1.6, gồm 16 UC: UC1.1 → UC6.1) và giao diện minh họa (Hình 9–81)**. Không tự ý thêm/bớt chức năng, không đổi tên nút, không đổi thông điệp lỗi.

---

## 1. Tổng quan dự án

Ứng dụng web quản lý phòng tập Pilates cho phòng tập quy mô vừa/nhỏ tại Việt Nam. Đặc thù: lớp Reformer bị giới hạn **sức chứa theo số máy**, nên hệ thống phải chống trùng lịch, chống vượt số máy, quản lý gói tập (số buổi/hạn dùng), danh sách chờ, no-show, lịch tập riêng gói 1-1/1-2, và **báo cáo tài chính thu chi theo tháng**.

**Toàn bộ UI, nhãn nút, thông báo lỗi đều bằng TIẾNG VIỆT** — dùng đúng nguyên văn trong mục 4 (đặc tả từng UC) bên dưới.

## 2. Tech stack & lệnh chạy

| Tầng | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS + Zustand + React Router + Recharts (biểu đồ UC6.1) |
| Backend | Spring Boot 3 (Java 17) + Spring Security (JWT) + Spring Data JPA |
| Database | MySQL 8 |
| Email/SMS | Interface `NotificationService` — dev dùng mock (log ra console + lưu bảng `notification_log`), prod cắm SendGrid/SMS gateway sau |
| Deploy | Docker Compose (frontend, backend, mysql) |

```bash
# Dev
docker compose up -d mysql
cd backend && ./mvnw spring-boot:run          # http://localhost:8080
cd frontend && npm i && npm run dev           # http://localhost:5173

# Build all
docker compose up --build
```

Cấu trúc thư mục:
```
picore/
├── frontend/           # React + Vite
│   └── src/
│       ├── pages/      # mỗi UC ↔ 1 nhóm page (xem mục 4)
│       ├── components/ # Sidebar, DataTable, StatusPill, ConfirmDialog, Toast...
│       ├── stores/     # Zustand: auth, members, classes, bookings, finance...
│       └── api/        # axios client
├── backend/
│   └── src/main/java/com/picore/
│       ├── auth/  member/  packageplan/  clazz/  equipment/
│       ├── trainer/  booking/  attendance/  notification/  finance/
│       └── common/ (exception, security, seed data)
└── docker-compose.yml
```

## 3. Vai trò & phân quyền (R1.4, R1.5)

4 vai trò, mỗi vai trò chỉ thấy menu/chức năng của mình. Route guard cả frontend lẫn backend (`@PreAuthorize`).

| Vai trò | Được truy cập |
|---|---|
| **ADMIN** (Quản trị viên) | UC1.2 Quản lý tài khoản, UC3.1 Cấu hình gói tập, UC4.1 Quản lý lớp học, UC4.2 Thiết bị, UC4.3 Quản lý HLV, **UC6.1 Tài chính**, xem toàn bộ |
| **RECEPTIONIST** (Lễ tân) | UC2.1 Quản lý hội viên, UC3.2 Đăng ký/gia hạn gói, UC4.1 Quản lý lớp học, UC5.3 Điểm danh, UC5.1 (đặt lịch hộ) |
| **TRAINER** (Huấn luyện viên) | UC4.4 Lịch dạy của tôi, UC5.5 Xem danh sách học viên |
| **MEMBER** (Hội viên) | UC2.2 Gói tập & Lịch sử, UC5.1 Đặt & hủy lịch, UC5.2 Đăng ký buổi 1-1/1-2 |

**⚠ QUAN TRỌNG — đăng nhập bằng EMAIL:** hệ thống KHÔNG có trường "tên đăng nhập" riêng. **Email chính là tên đăng nhập** cho mọi vai trò. Tài khoản hội viên được **tạo tự động khi lễ tân tạo hồ sơ hội viên (UC2.1)**, gắn với email của hội viên.

## 4. Đặc tả use case → màn hình (BẮT BUỘC KHỚP)

### UC1.1 — Đăng nhập (`/login`)
Giao diện theo **Hình 9**: card trắng bo góc căn giữa, logo **PiCore** (chữ "Pi" màu teal), subtitle "Hệ thống Quản lý Phòng tập Pilates", 2 input **Email** + **Mật khẩu**, link **"Quên mật khẩu?"**, nút **"Đăng nhập"** full-width màu teal.

- Đăng nhập bằng **email + mật khẩu** → redirect theo vai trò (Admin → `/admin/accounts`, Lễ tân → `/reception/members`, HLV → `/trainer/schedule`, Hội viên → `/member/booking`).
- Tiền điều kiện: tài khoản do quản trị viên cấp (UC1.2) **hoặc được tạo tự động khi đăng ký hội viên (UC2.1)**.
- **Sai email/mật khẩu** (Hình 10): banner đỏ "Email hoặc mật khẩu không đúng. Vui lòng thử lại."
- **Khóa sau 5 lần sai liên tiếp** (Hình 11): khóa đăng nhập **5 phút**, hiển thị "Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau 5 phút." — backend lưu `failed_attempts` + `locked_until`.
- **Luồng phụ S-1 Quên mật khẩu** (Hình 12): form nhập email → nút "Gửi liên kết đặt lại" → gửi email chứa token reset → trang nhập mật khẩu mới + xác nhận → lưu và thông báo thành công.
- **Email không tồn tại** (Hình 13): báo lỗi "Email không tồn tại trong hệ thống."
- Mật khẩu hash bằng BCrypt. JWT access token.

### UC1.2 — Quản lý tài khoản & phân quyền (ADMIN, `/admin/accounts`)
Layout theo **Hình 14**: sidebar tối màu teal đậm bên trái (logo PiCore + menu), header trắng có tiêu đề "Quản lý tài khoản người dùng" + badge người dùng "Admin – …" góc phải. Nội dung: ô tìm kiếm "Tìm theo tên, email..." + nút teal **"+ Thêm tài khoản"**, bảng cột: **Họ tên | Email | SĐT | Vai trò | Trạng thái | Thao tác**.
- Vai trò hiển thị dạng pill màu (Quản trị viên / Lễ tân / Huấn luyện viên / Hội viên). Trạng thái: pill xanh "Hoạt động" / pill xám-đỏ "Ngừng hoạt động".
- Thao tác: nút **"Sửa"** (cam) và **"Xóa"** (đỏ).

Luồng phụ:
- **S-1 Thêm tài khoản** (Hình 15): form các trường Họ tên, Email (**dùng làm tên đăng nhập**), Số điện thoại, Vai trò (dropdown), Mật khẩu, Nhập lại mật khẩu → nút "Lưu". Kiểm tra: **trùng email**, định dạng email, **mật khẩu ≥ 8 ký tự**, mật khẩu nhập lại khớp.
- **S-2 Chỉnh sửa** (Hình 19): form với dữ liệu hiện tại, nút "Cập nhật".
- **S-3 Vô hiệu hóa** (Hình 20): nhấn "Xóa" → hộp thoại xác nhận → set trạng thái "Ngừng hoạt động" (**soft delete, không xóa record**).
- **S-4 Tìm kiếm** (Hình 21, 22): lọc theo tên/email; không có kết quả → "Không tìm thấy tài khoản".

Thông báo lỗi luồng thay thế (Hình 16–18): **"Email đã tồn tại"** (email đã dùng cho tài khoản khác — Hình 17), lỗi định dạng email hiển thị ngay dưới trường, "Mật khẩu phải có ít nhất 8 ký tự", "Mật khẩu nhập lại không khớp".

### UC2.1 — Quản lý hội viên (LỄ TÂN, `/reception/members`)
Theo **Hình 23**: bảng cột **Họ tên | SĐT | Email | Ngày sinh | Giới tính | Trạng thái | Thao tác**; thao tác gồm **"Chi tiết"** (xanh dương), **"Sửa"** (cam), **"Xóa"** (đỏ); nút **"+ Thêm hội viên"**; ô tìm kiếm theo tên hoặc SĐT.

**⚠ Điểm mới quan trọng:** khi tạo hội viên mới, hệ thống **TỰ ĐỘNG tạo tài khoản đăng nhập (vai trò MEMBER) gắn với email của hội viên** và **gửi email kích hoạt kèm mật khẩu tạm**. Vì vậy **Email là trường BẮT BUỘC**.

- **S-1 Thêm hội viên** (Hình 24): form Họ tên(*), Số điện thoại(*), **Email(*)**, Ngày sinh, Giới tính, Ghi chú. Luồng lưu: (4) kiểm tra hợp lệ + **trùng SĐT và trùng email** → (5) lưu hồ sơ + **tự tạo tài khoản đăng nhập gắn email + gửi email kích hoạt (mật khẩu tạm)** + toast thành công.
- Luồng thay thế: "Số điện thoại đã tồn tại trong hệ thống" (Hình 26); **"Email đã tồn tại"** (đã dùng cho tài khoản hội viên hoặc nhân sự khác) → yêu cầu nhập email khác; thiếu trường bắt buộc (họ tên, SĐT, **email**) → highlight đỏ từng trường (Hình 25); SĐT/email sai định dạng → báo lỗi.
- **S-2 Sửa** → toast thành công (Hình 27).
- **S-3 Xem chi tiết** (Hình 29): modal/trang gồm thông tin cá nhân + **gói tập hiện tại** + **lịch sử tập luyện**.
- **S-4 Ngừng kích hoạt** (Hình 30, 31): xác nhận → trạng thái "Ngừng hoạt động" (soft delete; đồng thời vô hiệu tài khoản đăng nhập gắn kèm).
- **S-5 Tìm kiếm** (Hình 28): không thấy → "Không tìm thấy hội viên".

### UC2.2 — Xem gói tập & lịch sử tập (HỘI VIÊN, `/member/history`)
Tab **"Gói tập & Lịch sử"** (Hình 32):
- Khối trên: danh sách gói tập hiện tại — **tên gói, số buổi còn lại, ngày bắt đầu, ngày hết hạn, trạng thái**.
- Khối dưới: lịch sử buổi tập — **ngày, lớp học, huấn luyện viên, trạng thái (Đã tập / No-show)**, cuộn được.
- **S-1 lọc theo thời gian**: dropdown "Tuần này / Tháng này / Tùy chọn (date range)".
- Chưa có gói (Hình 33): "Chưa đăng ký gói tập nào" + hướng dẫn liên hệ lễ tân. Chưa có lịch sử: "Chưa có buổi tập nào được ghi nhận".
- **Hội viên chỉ xem được dữ liệu của chính mình** (kiểm tra ở backend theo user id trong JWT).

### UC3.1 — Cấu hình loại gói tập (ADMIN, `/admin/package-types`)
Theo **Hình 34–39**: bảng danh sách loại gói: **Tên gói | Phân loại | Số buổi | Thời hạn (ngày) | Giá | Trạng thái | Thao tác**.
- **Phân loại (enum):** `THEO_BUOI` (theo buổi), `THEO_THANG` (theo tháng), `KHONG_GIOI_HAN` (không giới hạn), `GOI_1_1`, `GOI_1_2`.
- **S-1 Thêm loại gói**: form Tên gói(*), Phân loại(*), Số buổi (bắt buộc nếu phân loại theo buổi/1-1/1-2), Thời hạn ngày(*), Giá(*), Mô tả.
- Validate: tên gói unique ("Tên gói tập đã tồn tại" — Hình 36), thiếu số buổi khi chọn theo buổi → lỗi trường bắt buộc (Hình 37), **giá/thời hạn không được âm**.
- **S-3 Ngừng áp dụng** (Hình 39): ẩn khỏi danh sách bán nhưng **không xóa** — các gói hội viên đã mua vẫn giữ nguyên lịch sử.

### UC3.2 — Đăng ký & gia hạn gói tập (LỄ TÂN, `/reception/register-package`)
Luồng theo **Hình 40**: (1) ô tìm hội viên theo tên/SĐT + nút "Tìm" → (2) hiển thị card thông tin hội viên → (3) chọn loại gói từ dropdown → (4) **hệ thống tự điền số buổi và tự tính ngày hết hạn = ngày bắt đầu + thời hạn gói** → (5) nút **"Xác nhận đăng ký"** → toast thành công (Hình 45).
- **S-1 không tìm thấy hội viên** (Hình 41, 42): thông báo + nút "Tạo hội viên mới" → mở form UC2.1, tạo xong **tự điền lại vào form đăng ký gói**.
- **S-2 gia hạn** (Hình 43, 44): nếu hội viên đang có gói còn hiệu lực → cảnh báo vàng; nếu tiếp tục → tạo gói mới với **ngày bắt đầu = ngày hết hạn gói cũ + 1**.
- **S-3 gói 1-1/1-2**: lưu gói như thường (chưa gán HLV/ca), hiển thị thông báo: hội viên cần tự đăng ký lịch tập hằng tuần qua UC5.2 trước hạn chót (xem mục 5).
- **Mỗi lần đăng ký/gia hạn thành công phải ghi 1 bản ghi giao dịch (`package_transaction`) với số tiền = giá gói tại thời điểm mua** — đây là nguồn dữ liệu doanh thu cho UC6.1.

### UC4.1 — Quản lý lớp học (ADMIN + LỄ TÂN, `/admin/classes`)
Theo **Hình 46**: bảng **Tên lớp | Loại thiết bị | Huấn luyện viên | Lịch học (pill các thứ: T2, T4, T6…) | Giờ | Sức chứa | Trạng thái | Thao tác**, nút "+ Thêm lớp mới".
- **Form thêm lớp** (Hình 47): Tên lớp(*), Loại thiết bị (dropdown từ UC4.2), Huấn luyện viên(*) — **dropdown CHỈ hiển thị HLV đang rảnh theo ca làm việc (UC4.3)**, Ngày trong tuần(*) — chọn nhiều, Giờ bắt đầu(*), Giờ kết thúc(*), Sức chứa tối đa(*), Mô tả. Nút "Lưu lớp học".
- Validate tại lưu: **E-1** tên lớp đã tồn tại → lỗi + highlight đỏ trường Tên lớp (Hình 48); **E-2** thiếu trường bắt buộc → highlight các trường trống (Hình 49); **E-3** khung giờ trùng buổi 1-1/1-2 mà hội viên đã đăng ký cho HLV đó → **chặn lưu**, báo lỗi yêu cầu đổi giờ hoặc đổi HLV (Hình 50). *(R4.8 — ràng buộc cứng, kiểm tra ở backend, không chỉ frontend.)*
- **S-1** sửa lớp (Hình 51). **S-2 Thời khóa biểu** (Hình 52): tab riêng, lưới lịch theo tuần (cột = thứ trong tuần), mỗi ô = card lớp gồm **tên lớp, HLV, số chỗ còn lại**; nút ← → chuyển tuần.
- Khi gán HLV cho lớp: **tự động cập nhật ca làm việc của HLV tuần tương ứng** (R4.7, xem UC4.3).

### UC4.2 — Khai báo thiết bị (ADMIN, `/admin/equipment`)
Theo **Hình 53–55**: bảng **Mã thiết bị | Tên | Loại | Vị trí/Phòng | Ghi chú**; form thêm: Mã thiết bị(*), Tên(*), Loại(*), Vị trí/Phòng, Ghi chú.
- **E-1**: mã thiết bị trùng → lỗi + highlight trường Mã thiết bị.
- Số thiết bị theo loại là **cơ sở tham chiếu cho sức chứa tối đa** khi tạo lớp (UC4.1) — hiển thị gợi ý "Loại này hiện có N máy" trong form tạo lớp.

### UC4.3 — Quản lý huấn luyện viên (ADMIN, `/admin/trainers`)
Theo **Hình 56**: danh sách HLV kèm cột **"Tổng giờ dạy tuần này"** — **tự động tổng hợp** từ các lớp đã gán + buổi 1-1/1-2, KHÔNG nhập tay.
- Thêm HLV: chọn từ tài khoản đã có vai trò TRAINER (UC1.2) → nhập hồ sơ (chuyên môn, SĐT liên hệ…).
- **S-1 Xem ca làm việc theo tuần** (Hình 57): lưới tuần hiển thị các khung giờ đã có lớp/buổi 1-1 của HLV đó; nút chuyển tuần để đối chiếu khối lượng giữa các tuần.
- **QUAN TRỌNG: ca làm việc KHÔNG có form khai báo thủ công.** Nó là **view tổng hợp (derived data)** từ bảng lớp học + booking 1-1/1-2. Không tạo bảng `work_shift` nhập tay.
- **S-2**: sửa hồ sơ hoặc "Ngừng hoạt động" → ẩn khỏi danh sách gán lớp mới, lớp đã gán không đổi.

### UC4.4 — Xem lịch dạy (HLV, `/trainer/schedule`)
Tab **"Lịch dạy của tôi"** (Hình 74): lưới lịch tuần gồm **cả lớp cố định lẫn buổi 1-1/1-2**; mỗi ô: tên lớp (hoặc tên hội viên với buổi 1-1), giờ bắt đầu–kết thúc, số học viên đăng ký. Chuyển tuần trước/sau, toggle xem theo ngày.
- **E-1** tuần trống → "Chưa có lịch dạy trong tuần này" (Hình 75).
- Click vào 1 ô → mở UC5.5.

### UC5.1 — Đặt & hủy lịch tập (HỘI VIÊN, `/member/booking`)
Theo **Hình 58**: thời khóa biểu tuần với card lớp, mỗi card có **số chỗ còn lại** và nút teal **"Đặt chỗ"** (lớp đầy → nút xám "Hết chỗ"/"Đã đầy"). Khối "Gói tập của tôi" hiển thị số buổi còn lại.
- Nhấn Đặt chỗ → backend kiểm tra theo đúng thứ tự: **(a) lớp còn chỗ, (b) hội viên có gói hiệu lực, (c) chưa đặt buổi này** → màn hình xác nhận (Hình 59) hiển thị chi tiết buổi học + gói sẽ bị trừ → xác nhận → **lưu booking + trừ 1 buổi** → kích hoạt UC5.4 + toast thành công.
- **E-1 lớp đầy** (Hình 60): dialog hỏi vào **danh sách chờ**; đồng ý → thêm vào waitlist (FIFO), khi có người hủy → hệ thống mời người đầu danh sách (gửi thông báo). Từ chối → đóng dialog.
- **E-2 không có gói hiệu lực** (Hình 61): "Bạn chưa có gói tập còn hiệu lực. Vui lòng liên hệ lễ tân để đăng ký gói tập."
- **E-3 đã đặt buổi này** (Hình 62): thông báo + link tới "Lịch tập của tôi".
- **S-1 Hủy lịch** (Hình 63, 64): trang "Lịch tập của tôi" — danh sách theo trạng thái **Sắp diễn ra / Đã hoàn thành / Đã hủy**; nút "Hủy" → xác nhận → **hủy booking + hoàn trả 1 buổi** + mở chỗ cho waitlist.
- Chống race condition: kiểm tra sức chứa và trừ buổi trong **1 transaction** (`SELECT ... FOR UPDATE` hoặc optimistic lock).
- Lễ tân có thể đặt lịch hộ hội viên (tác nhân phụ) — thêm ô chọn hội viên khi vai trò là RECEPTIONIST.

### UC5.2 — Đăng ký buổi 1-1/1-2 (HỘI VIÊN có gói 1-1/1-2, `/member/private-booking`)
Theo **Hình 69–71**:
1. Vào chức năng "Đăng ký buổi 1-1/1-2" → hệ thống kiểm tra gói thuộc loại 1-1/1-2 và **còn trong hạn đăng ký** (xem mục 5).
2. Hiển thị **danh sách HLV kèm các khung giờ còn trống trong tuần kế tiếp** (dựa trên ca làm việc tổng hợp UC4.3, loại trừ khung đã có lớp/buổi khác).
3. Chọn HLV + ngày + khung giờ. **Gói 1-2**: thêm bước chọn — mời một hội viên khác đi cùng HOẶC để hệ thống ghép với người đang chờ cùng khung giờ.
4. Xác nhận → backend **kiểm tra lại khung giờ còn trống (E-3)**, trừ 1 buổi, **khóa lịch HLV** khung giờ đó → kích hoạt UC5.4 gửi thông báo cho hội viên VÀ huấn luyện viên.
- **E-1 quá hạn** (Hình 71): "Đã hết hạn đăng ký cho tuần này. Vui lòng đăng ký cho tuần kế tiếp."
- **E-2 gói không thuộc 1-1/1-2**: thông báo không đủ điều kiện + đề xuất liên hệ đăng ký gói phù hợp.
- **E-4 gói 1-2 chưa ghép được**: cho chọn "Vào danh sách chờ ghép" hoặc "Tập một mình khung giờ này".
- **S-1**: hủy buổi 1-1/1-2 từ "Lịch tập của tôi" (chỉ trước hạn chót) → hoàn buổi + mở lại khung giờ HLV.

### UC5.3 — Điểm danh buổi học (LỄ TÂN, `/reception/attendance`)
Theo **Hình 65–68**: trang **"Điểm danh hôm nay"** — danh sách buổi học trong ngày kèm "x/y đã điểm danh" → click buổi → danh sách hội viên đã đặt kèm **gói tập + số buổi còn lại**, 2 nút mỗi hàng: **"Có mặt"** (xanh) / **"No-show"** (đỏ). Trạng thái cập nhật realtime trên danh sách.
- "Có mặt" → ghi nhận thời gian check-in, đánh dấu buổi "Đã tập" trong lịch sử.
- "No-show" → đánh dấu vắng (xem quy tắc trừ buổi ở mục 5).
- **E-1 Điểm danh nhanh** (Hình 68): nút "Điểm danh nhanh" → nhập SĐT → tìm hội viên + hiển thị gói → xác nhận → **trừ 1 buổi** (vì walk-in chưa đặt lịch nên chưa bị trừ) + ghi nhận lịch sử.

### UC5.4 — Gửi thông báo nhắc lịch (HỆ THỐNG tự động)
Include từ UC5.1/UC5.2, không có UI thao tác riêng ngoài **trang lịch sử thông báo** (Hình 73, đặt ở admin: `/admin/notifications`).
1. Nhận event đặt lịch thành công → tạo nội dung (tên lớp/HLV, ngày giờ, địa điểm) → **gửi xác nhận ngay** qua Email/SMS (Hình 72 — template email xác nhận).
2. **Lên lịch nhắc trước giờ tập theo cấu hình, mặc định trước 2 giờ** (scheduler: Spring `@Scheduled` quét bảng `scheduled_notification`).
3. Ghi trạng thái gửi vào `notification_log`.
- **E-1 gửi thất bại**: retry **tối đa 3 lần**; vẫn fail → đánh dấu "Gửi không thành công" để lễ tân theo dõi liên hệ thủ công.

### UC5.5 — Xem danh sách học viên (HLV)
Theo **Hình 76, 77**: từ ô lịch trong UC4.4 → danh sách hội viên đăng ký buổi đó: **họ tên, SĐT liên hệ, trạng thái (Đã đặt/Đã hủy)**; buổi đã diễn ra hiển thị thêm **trạng thái điểm danh (Có mặt/No-show)**.
- **E-1**: "Chưa có hội viên đăng ký cho buổi này".

### UC6.1 — Quản lý tài chính (ADMIN, `/admin/finance`) ★ MỚI
Menu sidebar thêm mục **"Tài chính"**. Giao diện theo **Hình 79**: bộ chọn tháng (mặc định = tháng hiện tại), 3 card tổng quan **Tổng thu | Tổng chi | Lợi nhuận (Thu − Chi)**, bên dưới là **danh sách khoản chi của tháng** + nút **"+ Thêm khoản chi"**. Có thể xem chi tiết từng khoản thu (danh sách giao dịch gói tập trong tháng) và từng khoản chi.

- **Tổng thu**: hệ thống **TỰ ĐỘNG tính** từ các giao dịch đăng ký/gia hạn gói tập (UC3.2 — bảng `package_transaction`) trong tháng đã chọn. **Không nhập tay doanh thu.**
- **Tổng chi**: do quản trị viên **tự nhập** qua các khoản chi.
- **Lợi nhuận = Tổng thu − Tổng chi**, tự tính và cập nhật lại ngay khi thêm/sửa/xóa khoản chi.

Luồng phụ:
- **S-1 Thêm khoản chi** (Hình 80): form **Loại chi phí(*)** — dropdown 4 giá trị đúng nguyên văn: *Lương huấn luyện viên / Chi phí thiết bị / Chi phí vận hành / Khác* — **Số tiền(*)**, **Ngày chi(*)**, Ghi chú → nút "Lưu" → lưu vào tháng tương ứng theo Ngày chi → cập nhật lại Tổng chi + Lợi nhuận.
- **E-1 Số tiền không hợp lệ**: số tiền ≤ 0 hoặc không phải số → hiển thị lỗi trên trường Số tiền, yêu cầu nhập lại (validate cả frontend lẫn backend).
- **S-2 Sửa/Xóa khoản chi**: mỗi hàng có nút "Sửa" (form như S-1, prefill dữ liệu) và "Xóa" (hộp thoại xác nhận → xóa → cập nhật lại tổng). *Lưu ý: khoản chi là dữ liệu admin tự nhập nên được phép xóa thật (hard delete) — khác quy tắc soft delete của các thực thể nghiệp vụ.*
- **S-3 So sánh theo tháng** (Hình 81): nút/tab **"So sánh theo tháng"** → **biểu đồ cột nhóm (Recharts)** hiển thị Thu, Chi, Lợi nhuận của **6 tháng gần nhất** để quan sát xu hướng.
- Tiền tệ hiển thị định dạng VNĐ: `12.500.000 ₫` (`Intl.NumberFormat('vi-VN')`).

## 5. Business rules bắt buộc (đọc kỹ — có 2 điểm đặc tả không nhất quán, đã chốt cách xử lý)

1. **Sức chứa lớp** = số máy Reformer/diện tích, set khi tạo lớp (UC4.1). Booking không bao giờ được vượt sức chứa — enforce bằng transaction ở backend (R5.3).
2. **Quy tắc trừ buổi (⚠ đặc tả mâu thuẫn — chốt như sau, cần confirm lại với nhóm):**
   - Đặt lịch thành công (UC5.1/UC5.2) → **trừ 1 buổi ngay** (đúng luồng cơ bản UC5.1 bước 7 và Glossary "Đặt chỗ").
   - Hủy lịch hợp lệ → **hoàn 1 buổi**.
   - Check-in "Có mặt" (UC5.3) → **KHÔNG trừ thêm lần nữa** (tránh trừ kép với bước 6 UC5.3), chỉ ghi nhận đã tập. Riêng **walk-in điểm danh nhanh (E-1)** chưa từng đặt lịch → trừ 1 buổi tại lúc check-in.
   - "No-show" → buổi đã trừ khi đặt **không hoàn lại** (đúng chính sách no-show trong Glossary).
3. **Hạn đăng ký buổi 1-1/1-2 (⚠ đặc tả chỗ ghi "23:59 Thứ 7", chỗ ghi "23:59 Chủ Nhật"):** implement thành hằng số cấu hình `PRIVATE_BOOKING_DEADLINE` (day-of-week + time), **mặc định 23:59 Chủ Nhật** theo đặc tả UC5.2 (bản chi tiết nhất). Đổi 1 chỗ trong config nếu nhóm chốt Thứ 7.
4. **Thứ tự xếp lịch tuần (R5.9):** lớp cố định của tuần chỉ được "chốt" sau khi hết hạn đăng ký 1-1/1-2 của tuần đó; buổi 1-1/1-2 đã đăng ký có **độ ưu tiên chặn** lớp cố định (R4.8/E-3 UC4.1).
5. **Ca làm việc HLV = dữ liệu dẫn xuất**, tự tổng hợp mỗi khi gán lớp (UC4.1) hoặc có booking 1-1/1-2 (UC5.2). Không có CRUD ca làm việc.
6. **Ca hoạt động phòng tập**: ca sáng 06:00–12:00, ca chiều 13:00–19:00 — dùng làm khung giới hạn khi chọn giờ tạo lớp và khung giờ 1-1/1-2.
7. **Tài khoản & email:** email là định danh đăng nhập duy nhất, **unique toàn hệ thống** (chung cho cả nhân sự lẫn hội viên). Tạo hội viên (UC2.1) → tự tạo `user_account` role MEMBER + mật khẩu tạm ngẫu nhiên + gửi email kích hoạt.
8. **Doanh thu (UC6.1):** mỗi giao dịch đăng ký/gia hạn gói (UC3.2) ghi `package_transaction(amount = giá gói tại thời điểm mua, created_at)`. Tổng thu tháng = SUM(amount) theo tháng của `created_at`. Không tính lại theo giá gói hiện tại (giá gói có thể đổi sau này).
9. **Soft delete mọi nơi**: tài khoản, hội viên, loại gói, HLV, lớp học chỉ đổi trạng thái "Ngừng hoạt động/Ngừng áp dụng", không xóa vật lý. **Ngoại lệ duy nhất:** khoản chi UC6.1 được xóa thật theo đặc tả S-2.
10. **Cảnh báo gói sắp hết** (R3.4): badge/banner khi gói còn ≤ 2 buổi hoặc ≤ 7 ngày hết hạn (hiển thị ở UC2.2 và card hội viên UC3.2).
11. **Đăng nhập**: BCrypt, khóa 5 phút sau 5 lần sai, reset mật khẩu qua email token (R1.3).
12. **Ghi nhật ký thao tác quan trọng** (bảng `audit_log`): tạo/sửa/vô hiệu tài khoản, bán gói, điểm danh, hủy lịch, thêm/sửa/xóa khoản chi.

## 6. Design system (khớp giao diện minh họa Hình 9–81)

- **Màu chủ đạo:** teal `#0D9488` (nút chính, link, logo "Pi"); sidebar nền teal đậm/xanh rêu tối `#0F3D3E`–`#134E4A`, chữ trắng, item active nền sáng hơn.
- **Nền nội dung:** xám nhạt `#F3F4F6`; card/bảng nền trắng, bo góc `rounded-lg`, shadow nhẹ.
- **Nút:** chính = teal solid; "Chi tiết" = xanh dương `#3B82F6`; "Sửa" = cam `#F59E0B`; "Xóa"/"No-show" = đỏ `#EF4444`; "Có mặt" = xanh lá `#22C55E`; disabled/"Hết chỗ" = xám.
- **Pill trạng thái:** "Hoạt động"/"Đã tập" xanh lá nhạt; "Ngừng hoạt động"/"Đã hủy" xám hoặc đỏ nhạt; "No-show" đỏ nhạt; "Sắp diễn ra" xanh dương nhạt.
- **Card tài chính (UC6.1):** Tổng thu chữ xanh lá, Tổng chi chữ đỏ, Lợi nhuận chữ teal (âm thì đỏ); biểu đồ so sánh dùng 3 series cùng bảng màu này.
- **Bảng:** header nền xám nhạt chữ đậm, hàng kẻ mảnh, hover highlight.
- **Layout chung sau đăng nhập:** sidebar trái cố định (logo PiCore trên cùng, menu theo vai trò — Admin gồm: Tổng quan, Tài khoản, Hội viên, Gói tập, Lớp học, Điểm danh, Thiết bị, **Tài chính** — "Đăng xuất" dưới cùng) + header trắng (tiêu đề trang bên trái, badge "«Vai trò» – «Họ tên»" bên phải).
- **Form lỗi:** viền đỏ + message đỏ ngay dưới trường; lỗi chung = banner đỏ nhạt trên form. Thành công = toast xanh góc phải.
- **Font:** Roboto (Google Fonts) — hỗ trợ tiếng Việt đầy đủ.
- **Responsive** (thông số bổ sung 1.3): desktop-first nhưng phải dùng được trên tablet/phone — sidebar thu thành hamburger dưới `md`.
- Lưới thời khóa biểu (UC4.1 S-2, UC4.4, UC5.1): 7 cột T2→CN, card lớp trong ô, nút ←/→ chuyển tuần, nhãn "Tuần dd/mm – dd/mm".

## 7. Data model (MySQL)

```
user_account(id, full_name, email UQ, phone, password_hash, role ENUM(ADMIN,RECEPTIONIST,TRAINER,MEMBER), status, failed_attempts, locked_until, must_change_password BOOL, created_at)
member(id, full_name, phone UQ, email UQ, dob, gender, note, status, user_account_id FK UQ)
package_type(id, name UQ, category ENUM(THEO_BUOI,THEO_THANG,KHONG_GIOI_HAN,GOI_1_1,GOI_1_2), sessions INT NULL, duration_days, price, description, status)
member_package(id, member_id FK, package_type_id FK, start_date, end_date, sessions_remaining, status ENUM(ACTIVE,EXPIRED,USED_UP))
package_transaction(id, member_package_id FK, member_id FK, amount DECIMAL(12,0), type ENUM(NEW,RENEWAL), created_at)   -- nguồn doanh thu UC6.1
expense(id, category ENUM(LUONG_HLV,CHI_PHI_THIET_BI,CHI_PHI_VAN_HANH,KHAC), amount DECIMAL(12,0), expense_date, note, created_by FK, created_at)   -- UC6.1
equipment(id, code UQ, name, type, location, note, status)
trainer_profile(id, user_account_id FK UQ, specialty, contact_phone, status)
gym_class(id, name UQ, equipment_type, trainer_id FK, days_of_week SET, start_time, end_time, capacity, description, status)
class_session(id, gym_class_id FK NULL, trainer_id FK, session_date, start_time, end_time, type ENUM(GROUP,PRIVATE_1_1,PRIVATE_1_2), capacity)
booking(id, class_session_id FK, member_id FK, member_package_id FK, status ENUM(BOOKED,CANCELLED,ATTENDED,NO_SHOW), booked_at, cancelled_at, checked_in_at)
waitlist(id, class_session_id FK, member_id FK, created_at, notified BOOL)
notification_log(id, member_id FK, channel ENUM(EMAIL,SMS), type ENUM(CONFIRM,REMINDER,WAITLIST_INVITE,ACTIVATION), content, status ENUM(SENT,FAILED), retry_count, sent_at)
scheduled_notification(id, booking_id FK, send_at, sent BOOL)
audit_log(id, actor_id, action, entity, entity_id, detail, created_at)
```
Buổi 1-1/1-2 = `class_session` với `type=PRIVATE_*`, `gym_class_id=NULL`, capacity 1 hoặc 2. Ca làm việc HLV = query tổng hợp `class_session` theo `trainer_id` + tuần. Không có bảng username riêng — đăng nhập bằng `user_account.email`.

## 8. API chính (REST, prefix `/api`)

```
POST /auth/login (email, password) | POST /auth/forgot-password | POST /auth/reset-password
GET|POST|PUT|PATCH /accounts (ADMIN)                       # PATCH = đổi trạng thái
GET|POST|PUT|PATCH /members (RECEPTIONIST)                 # POST tự tạo user_account + gửi email kích hoạt
GET /members/{id}/history
GET|POST|PUT|PATCH /package-types (ADMIN)
POST /member-packages (RECEPTIONIST)                       # đồng thời ghi package_transaction
GET /members/{id}/packages
GET|POST|PUT|PATCH /classes ; GET /timetable?week=YYYY-Www
GET|POST|PUT|PATCH /equipment (ADMIN)
GET|POST|PUT|PATCH /trainers ; GET /trainers/{id}/shifts?week=
GET /me/packages ; GET /me/history ; GET /me/bookings                (MEMBER)
POST /bookings ; DELETE /bookings/{id} ; POST /waitlist
GET /private-booking/slots?week= ; POST /private-booking             (MEMBER gói 1-1/1-2)
GET /attendance/today ; POST /attendance/{bookingId}/check-in|no-show
POST /attendance/quick-checkin (body: phone)                         (RECEPTIONIST)
GET /notifications (ADMIN)
GET /trainer/schedule?week= ; GET /sessions/{id}/attendees           (TRAINER)
GET /finance/report?month=YYYY-MM                                    (ADMIN, UC6.1: tổng thu/chi/lợi nhuận + chi tiết)
GET|POST|PUT|DELETE /finance/expenses                                (ADMIN, UC6.1)
GET /finance/comparison?months=6                                     (ADMIN, UC6.1 S-3)
```
Response lỗi chuẩn: `{ "field": "email", "message": "Email đã tồn tại" }` — message tiếng Việt đúng nguyên văn mục 4.

## 9. Seed data (để demo & chạy thử ngay)

- 1 admin (`admin@picore.vn / Admin123!`), 2 lễ tân, 3 HLV, 10 hội viên (mỗi hội viên có tài khoản gắn email).
- 5 loại gói: "Gói 12 buổi" (THEO_BUOI, 12 buổi/60 ngày), "Gói tháng" (THEO_THANG/30 ngày), "Gói không giới hạn 3 tháng", "Gói 1-1 (10 buổi)", "Gói 1-2 (10 buổi)".
- 8 máy Reformer (REF-01…REF-08) + thảm Mat.
- 6 lớp cố định tuần này/tuần sau (Reformer sức chứa 6–8, Mat sức chứa 10), vài booking mẫu, 1 lớp đầy chỗ để test waitlist, 1 hội viên có gói sắp hết để test cảnh báo.
- **Tài chính:** giao dịch gói tập rải đều **6 tháng gần nhất** (mỗi tháng 5–15 giao dịch) + mỗi tháng 3–5 khoản chi đủ 4 loại — để Hình 79 và biểu đồ so sánh Hình 81 có dữ liệu ngay.

## 10. Thứ tự triển khai & Definition of Done

Thứ tự build (theo phụ thuộc dữ liệu của sơ đồ use case): **UC1.1 → UC1.2 → UC2.1 → UC3.1 → UC3.2 → UC4.2 → UC4.3 → UC4.1 → UC2.2 → UC5.1 → UC5.2 → UC5.3 → UC5.4 → UC4.4 → UC5.5 → UC6.1** *(UC6.1 cần dữ liệu giao dịch từ UC3.2 nên làm cuối).*

Một UC được coi là DONE khi:
- [ ] Luồng cơ bản + **TẤT CẢ luồng phụ (S-x) và luồng thay thế (E-x)** trong mục 4 hoạt động đúng.
- [ ] Nhãn nút, tiêu đề, thông báo lỗi **đúng nguyên văn tiếng Việt** như đặc tả.
- [ ] Giao diện khớp bố cục Hình tương ứng (sidebar, bảng, màu nút, pill trạng thái theo mục 6).
- [ ] Phân quyền chặn đúng cả frontend route lẫn backend endpoint.
- [ ] Tiền/hậu điều kiện thỏa (vd: thao tác fail thì **không thay đổi dữ liệu**).
- [ ] Business rules mục 5 được enforce ở backend (transaction, unique, deadline…).

---

## Harness: PiCore Agent Team

**Mục tiêu:** Điều phối team 3 agent tự động implement từng UC của PiCore — backend (Spring Boot) + frontend (React/TS) + QA verification.

**Trigger:** Khi cần implement hoặc sửa một UC, dùng skill `implement-uc`. Ví dụ: "implement UC1.1", "xây module quản lý hội viên", "làm lại frontend UC5.1".

**Agents:** `.claude/agents/backend-dev.md` · `frontend-dev.md` · `qa-verifier.md`

**Skill:** `.claude/skills/implement-uc/SKILL.md`

**Không trigger:** Câu hỏi về spec/design, git operations, database setup — trả lời trực tiếp.

**Biến đổi lịch sử:**
| Ngày | Thay đổi | Đối tượng | Lý do |
|------|---------|-----------|-------|
| 2026-07-15 | Khởi tạo | Toàn bộ | Xây harness ban đầu |
| 2026-07-16 | Scaffold project | backend/ + frontend/ | Tạo cấu trúc dự án đầy đủ (pom.xml, Spring Security/JWT common, React/Vite/Tailwind, docker-compose) |
| 2026-07-16 | Implement UC1.1 | auth module + Login/ForgotPassword/ResetPassword pages | Đăng nhập + quên mật khẩu + JWT |
| 2026-07-16 | Implement UC1.2 | account module + shared Layout/Sidebar/ProtectedRoute | Quản lý tài khoản ADMIN + AuditLog |
| 2026-07-16 | Implement UC2.1 | member module + ReceptionMembersPage | Quản lý hội viên + tự tạo MEMBER account |
| 2026-07-16 | Implement UC3.1 | packageplan module + AdminPackageTypesPage | Cấu hình loại gói tập (ADMIN) |
| 2026-07-18 | Implement UC3.2 | memberpackage module + RegisterPackagePage | Đăng ký/gia hạn gói tập (RECEPTIONIST) + package_transaction |
| 2026-07-18 | Implement UC4.2 | equipment module + AdminEquipmentPage + Flyway V2 | Khai báo thiết bị (ADMIN) + count-by-type cho UC4.1 |
| 2026-07-18 | Implement UC4.3 | trainer module + clazz stubs + AdminTrainersPage + Flyway V3 | Quản lý HLV (ADMIN) + lưới ca làm việc dẫn xuất |
| 2026-07-18 | Implement UC4.1 | clazz module full + timetable + AdminClassesPage 2 tab | Quản lý lớp học (ADMIN+LỄ TÂN) + auto-generate sessions + E-3 R4.8 |
| 2026-07-18 | Implement UC2.2 | booking stub + me module (MeController/MeService) + MemberHistoryPage | Xem gói tập & lịch sử tập (MEMBER) + nearExpiry badge + filter WEEK/MONTH/CUSTOM |
| 2026-07-18 | Implement UC5.1 | booking module full + waitlist + BookingController/Service + timetable patch + MemberBookingPage + MyBookingsPage | Đặt & hủy lịch tập (MEMBER) + transaction lock + waitlist FIFO |
| 2026-07-18 | Implement UC5.2 | private_booking module + PrivateBookingService/Controller + PrivateBookingPage frontend | Đăng ký buổi 1-1/1-2 (MEMBER) + slot grid + matchmaking + deadline logic |
| 2026-07-18 | Fix UC5.2 W1 | V4__add_class_session_trainer_slot_unique.sql + PrivateBookingService.createSession() | Race condition: unique constraint (trainer_id, session_date, start_time) + catch DataIntegrityViolationException → 409 |
| 2026-07-18 | Fix UC5.2 W2 | PrivateBookingService.getSlots() + hasActiveGoi12Package() | Matchmaking reachable: GOI_1_2 thấy slot "available" khi có PRIVATE_1_2 chưa đủ 2 người |
| 2026-07-19 | Implement UC5.3 | attendance module + AttendanceService/Controller + AttendancePage + QuickCheckinDialog | Điểm danh buổi học (RECEPTIONIST) + điểm danh nhanh walk-in + optimistic update |
| 2026-07-19 | Implement UC5.4 | NotificationLog/ScheduledNotification entities + MockNotificationService impl + NotificationScheduler + NotificationController + NotificationsPage | Thông báo nhắc lịch tự động (scheduler 60s) + lịch sử thông báo admin |
| 2026-07-19 | Implement UC4.4 | TrainerScheduleService/Controller/DTO + TrainerSchedulePage | Lịch dạy HLV (TRAINER) + lưới tuần 7 cột + batch-load booking counts |
| 2026-07-19 | Implement UC5.5 | SessionAttendeesResponse + getSessionAttendees() + SessionAttendeesPage | Xem danh sách học viên (TRAINER) + security guard trainer ownership + cột điểm danh isPast |
| 2026-07-19 | Implement UC6.1 | finance module (Expense entity + FinanceService/Controller) + FinancePage + ExpenseFormModal | Quản lý tài chính ADMIN: tổng thu tự động, khoản chi CRUD hard-delete, BarChart Recharts 6 tháng |
