# PiCore — Hệ thống Quản lý Phòng tập Pilates

Ứng dụng quản lý toàn diện cho phòng tập Pilates: thành viên, gói tập, đặt lịch, điểm danh và tài chính.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt lần đầu](#2-cài-đặt-lần-đầu)
3. [Chạy ứng dụng](#3-chạy-ứng-dụng)
4. [Tài khoản mặc định](#4-tài-khoản-mặc-định)
5. [Cấu trúc dự án](#5-cấu-trúc-dự-án)
6. [Biến môi trường](#6-biến-môi-trường)
7. [API Backend](#7-api-backend)
8. [Backup dữ liệu](#8-backup-dữ-liệu)
9. [Xử lý sự cố thường gặp](#9-xử-lý-sự-cố-thường-gặp)

---

## 1. Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Java JDK | 17 | [Tải tại đây](https://adoptium.net/) |
| Apache Maven | 3.9 | Hoặc dùng `./mvnw` đi kèm |
| Node.js | 20 LTS | [Tải tại đây](https://nodejs.org/) |
| MySQL | 8.0 | Hoặc dùng Docker (xem bên dưới) |
| Docker + Compose | 24+ | Chỉ cần nếu chạy bằng Docker |

Kiểm tra phiên bản đã cài:

```bash
java -version
mvn -version
node -version
mysql --version
docker -version
```

---

## 2. Cài đặt lần đầu

### Bước 1 — Clone hoặc giải nén dự án

```bash
git clone <repo-url> D:\Pi-core
cd D:\Pi-core
```

### Bước 2 — Khởi tạo cơ sở dữ liệu

> **Chỉ thực hiện một lần duy nhất.**

Đăng nhập MySQL bằng tài khoản `root` rồi chạy script:

```bash
mysql -u root -p < backend\src\main\resources\db\setup.sql
```

Script này sẽ tự động:
- Tạo database `picore`
- Tạo user `picore` với mật khẩu `picore123`
- Cấp đầy đủ quyền cho user trên database

### Bước 3 — Cài đặt thư viện Frontend

```bash
cd frontend
npm install
cd ..
```

---

## 3. Chạy ứng dụng

### Cách A — Windows (khuyến nghị cho người mới)

Double-click vào file `start.bat` ở thư mục gốc.

Script tự động:
1. Kiểm tra MySQL đang chạy trên cổng 3306
2. Mở cửa sổ PowerShell chạy Backend (`:8080`)
3. Mở cửa sổ PowerShell chạy Frontend (`:5173`)
4. Tự động mở trình duyệt tại `http://localhost:5173`

### Cách B — Chạy thủ công (2 terminal riêng biệt)

**Terminal 1 — Backend:**

```bash
cd D:\Pi-core\backend
mvn spring-boot:run
```

Chờ đến khi thấy dòng `Started PicoreApplication` là backend đã sẵn sàng tại `http://localhost:8080`.

**Terminal 2 — Frontend:**

```bash
cd D:\Pi-core\frontend
npm run dev
```

Truy cập ứng dụng tại `http://localhost:5173`.

### Cách C — Docker (không cần cài Java/Node cục bộ)

```bash
cd D:\Pi-core
docker compose up --build
```

| Dịch vụ | URL |
|---|---|
| Frontend | `http://localhost` (cổng 80) |
| Backend API | `http://localhost:8080/api` |
| MySQL | `localhost:3306` |

Dừng Docker:

```bash
docker compose down
```

Dừng và xóa toàn bộ dữ liệu:

```bash
docker compose down -v
```

---

## 4. Tài khoản mặc định

Các tài khoản này được tạo sẵn khi ứng dụng khởi động lần đầu.

| Vai trò | Email | Mật khẩu | Quyền hạn |
|---|---|---|---|
| **Admin** | `admin@picore.vn` | `Admin123!` | Toàn quyền hệ thống |
| **Lễ tân** | `staff@picore.vn` | `Staff123!` | Quản lý thành viên, đặt lịch, điểm danh |
| **Huấn luyện viên** | `trainer@picore.vn` | `Trainer123!` | Xem lịch dạy, quản lý buổi tập |
| **Thành viên** | `member@picore.vn` | `Member123!` | Đặt lịch, xem gói tập, lịch sử |

> **Quan trọng:** Đổi mật khẩu Admin ngay sau lần đăng nhập đầu tiên trên môi trường thực tế.

---

## 5. Cấu trúc dự án

```
Pi-core/
├── backend/                    # Spring Boot 3.3.5 (Java 17)
│   ├── src/main/java/com/picore/
│   │   ├── auth/               # Đăng nhập, JWT, quản lý tài khoản
│   │   ├── member/             # Quản lý thành viên
│   │   ├── packageplan/        # Loại gói tập
│   │   ├── memberpackage/      # Đăng ký / gia hạn gói
│   │   ├── equipment/          # Quản lý thiết bị
│   │   ├── trainer/            # Hồ sơ và lịch huấn luyện viên
│   │   ├── clazz/              # Lớp học và ca tập
│   │   ├── booking/            # Đặt lịch nhóm, danh sách chờ
│   │   ├── private_booking/    # Đặt lịch cá nhân 1-1 / 1-2
│   │   ├── attendance/         # Điểm danh
│   │   ├── notification/       # Thông báo email, nhắc lịch tự động
│   │   ├── me/                 # API tự phục vụ cho thành viên
│   │   ├── finance/            # Doanh thu và chi phí
│   │   └── common/             # Cấu hình Security, JWT, xử lý lỗi
│   └── src/main/resources/
│       ├── application.yml     # Cấu hình chính
│       ├── application-dev.yml # Cấu hình môi trường phát triển
│       └── db/
│           ├── setup.sql       # Script khởi tạo DB (chạy 1 lần)
│           └── migration/      # File Flyway V1–V4 (sẵn sàng kích hoạt)
│
├── frontend/                   # React 18 + TypeScript + Vite
│   └── src/
│       ├── api/                # 17 module Axios (một file cho mỗi domain)
│       ├── components/         # Layout, Sidebar, Header, ProtectedRoute
│       ├── pages/              # Trang theo từng vai trò
│       ├── stores/             # Zustand state (auth, memberPackage)
│       └── types/              # TypeScript types
│
├── docker-compose.yml          # Compose 3 dịch vụ: mysql + backend + frontend
├── start.bat                   # Khởi động nhanh trên Windows
├── backup.bat                  # Backup MySQL tự động
└── CLAUDE.md                   # Đặc tả đầy đủ của dự án (nguồn tham chiếu chính)
```

---

## 6. Biến môi trường

Mặc định ứng dụng chạy được mà không cần cấu hình thêm. Muốn thay đổi, tạo file `.env` ở thư mục gốc hoặc đặt biến môi trường hệ thống:

| Biến | Mặc định | Mô tả |
|---|---|---|
| `DB_USERNAME` | `picore` | User MySQL |
| `DB_PASSWORD` | `picore123` | Mật khẩu MySQL |
| `JWT_SECRET` | *(có sẵn trong config)* | Khóa bí mật JWT — **phải đổi trên production** |
| `SPRING_PROFILES_ACTIVE` | *(không đặt)* | Đặt `dev` để bật chế độ phát triển |

Bật profile `dev` (show SQL, dùng Mailhog cho email):

```bash
# Windows PowerShell
$env:SPRING_PROFILES_ACTIVE="dev"
mvn spring-boot:run
```

---

## 7. API Backend

- Base URL: `http://localhost:8080/api`
- Tất cả request (trừ `/api/auth/**`) yêu cầu header:

```
Authorization: Bearer <JWT_TOKEN>
```

Lấy token:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@picore.vn","password":"Admin123!"}'
```

Đặc tả đầy đủ tất cả endpoint có trong file `CLAUDE.md`.

---

## 8. Backup dữ liệu

Chạy `backup.bat` để xuất toàn bộ dữ liệu ra file SQL:

```
D:\Pi-core\backups\picore_YYYY-MM-DD.sql
```

Script tự động xóa các bản backup cũ hơn 30 ngày. Có thể thêm vào **Task Scheduler** của Windows để chạy hàng ngày tự động.

---

## 9. Xử lý sự cố thường gặp

### Backend không khởi động — lỗi kết nối MySQL

```
com.mysql.cj.jdbc.exceptions.CommunicationsException: Communications link failure
```

**Nguyên nhân:** MySQL chưa chạy.

**Giải quyết:**
```bash
# Kiểm tra MySQL
docker compose up -d mysql
# hoặc bật XAMPP MySQL
```

---

### Cổng 8080 hoặc 5173 đã bị chiếm

**Giải quyết:** Tìm và tắt tiến trình đang dùng cổng đó:

```powershell
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

---

### Frontend báo lỗi `401 Unauthorized` khi gọi API

**Nguyên nhân:** Token đã hết hạn (JWT sống 24 giờ) hoặc chưa đăng nhập.

**Giải quyết:** Đăng xuất rồi đăng nhập lại. Zustand store sẽ tự cập nhật token mới.

---

### Không nhận được email thông báo

**Nguyên nhân:** Trên môi trường phát triển, ứng dụng dùng `MockNotificationService` — email chỉ được ghi vào console và database, không gửi thực tế.

**Xem log email giả:**
```bash
# Trong console backend, tìm dòng bắt đầu bằng [MockNotification]
# hoặc xem bảng notification_log trong database
```

Để gửi email thực, bật profile `smtp` và cấu hình SMTP Gmail trong `application.yml`.

---

### Lỗi `Access Denied` khi tạo database

**Giải quyết:** Đảm bảo chạy `setup.sql` bằng tài khoản `root` hoặc tài khoản có quyền `CREATE USER` và `GRANT`:

```bash
mysql -u root -p < backend\src\main\resources\db\setup.sql
```

---

## Công nghệ sử dụng

| Lớp | Công nghệ |
|---|---|
| Backend | Spring Boot 3.3.5, Spring Security, Spring Data JPA, JWT (jjwt 0.12.6) |
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Zustand, Axios, Recharts |
| Database | MySQL 8.0, Hibernate (ddl-auto), Flyway SQL (sẵn sàng) |
| Containerization | Docker, Docker Compose, Nginx (SPA reverse proxy) |
| Build | Maven 3.9, Node 20 / npm |
