## Frontend done: UC3.2

### Files created/modified

**Tạo mới:**
- `D:\Pi-core\frontend\src\types\memberPackage.ts` — TypeScript types cho gói hội viên
- `D:\Pi-core\frontend\src\api\memberPackage.ts` — axios functions (searchMembers, registerPackage, getMemberPackages)
- `D:\Pi-core\frontend\src\stores\memberPackageStore.ts` — Zustand store (theo pattern `stores/auth.ts`, dùng `create`)
- `D:\Pi-core\frontend\src\pages\reception\RegisterPackagePage.tsx` — trang chính UC3.2

**Sửa:**
- `D:\Pi-core\frontend\src\api\endpoints.ts` — thêm `MEMBERS.SEARCH = '/members/search'`
- `D:\Pi-core\frontend\src\App.tsx` — thay Placeholder bằng `<RegisterPackagePage />` cho route `/reception/register-package`
- `D:\Pi-core\frontend\src\components\Sidebar.tsx` — đổi nhãn menu RECEPTIONIST `Đăng ký gói` → `Đăng ký gói tập` (item đã có sẵn từ trước, đúng vị trí sau "Hội viên")

### TypeScript types defined
- `MemberPackageResponse` — khớp response POST/GET (type & amountPaid optional vì backend ẩn ở GET list)
- `RegisterPackageRequest` — { memberId, packageTypeId, startDate? }
- `MemberPackageStatus` = 'ACTIVE' | 'EXPIRED' | 'USED_UP'
- `TransactionType` = 'NEW' | 'RENEWAL'
- Tái dùng `MemberResponse`, `PackageTypeResponse`, `PackageCategory` từ `types/index.ts`

### API functions
- `searchMembers(query)` → GET `/members/search?q=` (trả `[]` khi query rỗng, không gọi API)
- `registerPackage(req)` → POST `/member-packages`
- `getMemberPackages(memberId)` → GET `/members/{id}/packages`
- Loại gói ACTIVE: tái dùng `packageTypesApi.getActive()` (GET `/package-types/active`) + lọc `status === 'ACTIVE'` phía client cho chắc

### Routes added
- `/reception/register-package` → RECEPTIONIST → RegisterPackagePage (đã nằm trong ProtectedRoute allowedRoles={['RECEPTIONIST']})

### Logic đã implement
- Section 1 Tìm hội viên: input + nút teal "Tìm" → danh sách kết quả clickable → chọn hiện card teal (họ tên bold, SĐT, email, gói hiện tại + số buổi còn lại + ngày hết hạn).
  - S-1: không tìm thấy → "Không tìm thấy hội viên" + nút "Tạo hội viên mới" (navigate `/reception/members`).
  - Badge cam "⚠ Sắp hết buổi" (warningSessions), badge vàng "⚠ Sắp hết hạn" (warningExpiry) đọc từ gói ACTIVE.
- Section 2 (chỉ hiện sau khi chọn hội viên): dropdown loại gói ACTIVE → auto-fill read-only Số buổi (hoặc "Không giới hạn"), Giá (`Intl.NumberFormat('vi-VN') + ' ₫'`), Ngày bắt đầu, Ngày hết hạn dự kiến.
  - S-2 gia hạn: nếu có gói ACTIVE → banner vàng "Hội viên đang có gói còn hiệu lực. Bạn có chắc muốn đăng ký thêm không?"; preview ngày bắt đầu = end gói cũ + 1.
  - Nút teal solid full-width "Xác nhận đăng ký".
  - Thành công: Toast xanh "Đăng ký gói tập thành công!"; nếu `isPrivatePackage` → banner teal thông báo S-3; reset dropdown, card tự refresh gói mới.
- Xử lý lỗi: field `memberId` → dưới ô tìm; field `packageTypeId` → dưới dropdown; lỗi chung → banner đỏ trên form (dùng `parseApiError`).

### Kiểm tra
- `npx tsc --noEmit` PASS, không lỗi type.

### Issues / TODO
- **Ngày hết hạn / ngày bắt đầu ở Section 2 là PREVIEW phía client** (start gói mới = today; gia hạn = end gói cũ + 1; end = start + durationDays). Backend là nguồn chân lý; card hội viên sẽ hiển thị giá trị thật sau khi refresh. Preview end dùng công thức `start + durationDays` khớp mô tả backend.
- **Quyền endpoint `/package-types/active` cho RECEPTIONIST**: frontend gọi qua `packageTypesApi.getActive()`. Cần backend đảm bảo RECEPTIONIST được phép GET (task note UC3.1 có nhắc "endpoint RECEPTIONIST cần xem lại quyền"). Nếu trả 403, dropdown sẽ rỗng.
- **S-1 "Tạo hội viên mới"** hiện điều hướng sang `/reception/members` (UC2.1). Chưa auto điền lại hội viên mới vào form đăng ký sau khi tạo (spec S-1 mong muốn) — cần cơ chế truyền lại member vừa tạo (query param / state) khi UC2.1 hỗ trợ; để mở rộng sau.
- `startDate` luôn gửi kèm request; backend bỏ qua khi RENEWAL (đúng contract).
