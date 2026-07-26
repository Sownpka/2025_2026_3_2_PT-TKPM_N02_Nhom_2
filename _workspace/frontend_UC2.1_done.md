## Frontend done: UC2.1 — Quản lý hội viên (Lễ tân)

### Files created
- `frontend/src/api/members.ts` — API client: `getMembers(search?)`, `createMember`, `updateMember`, `toggleMemberStatus`, `getMemberDetail`. Dùng `MEMBERS` từ `endpoints.ts` (`BASE`, `BY_ID`, `STATUS`, `HISTORY`). Payload interfaces `CreateMemberPayload` / `UpdateMemberPayload` export tại đây.
- `frontend/src/pages/reception/ReceptionMembersPage.tsx` — Trang chính UC2.1.

### Files modified
- `frontend/src/types/index.ts` — thêm `MemberResponse`, `ActivePackageInfo`, `BookingHistoryItem`, `MemberDetailResponse` (dùng lại `Status`, `Gender` có sẵn).
- `frontend/src/App.tsx` — import + thay Placeholder `/reception/members` bằng `<ReceptionMembersPage />`.

### Page details
**Bảng:** cột Họ tên | SĐT | Email | Ngày sinh | Giới tính | Trạng thái | Thao tác.
- Ngày sinh: `new Date(dob).toLocaleDateString('vi-VN')`, null → "—".
- Giới tính: Nam/Nữ/Khác/"—".
- StatusPill "Hoạt động"/"Ngừng hoạt động" (style copy từ AdminAccountsPage).
- Thao tác: "Chi tiết" (blue-500), "Sửa" (amber-500), "Xóa" (red-500). Nút Xóa disabled khi status=INACTIVE.
- Empty state: "Không tìm thấy hội viên".

**Toolbar:** input tìm kiếm `w-64` placeholder "Tìm theo tên, SĐT..." debounce 300ms; nút "+ Thêm hội viên" (teal).

**Modal Thêm (S-1):** Họ tên*, SĐT*, Email* (hint "Email sẽ được dùng làm tên đăng nhập"), Ngày sinh (date), Giới tính (select ""/MALE/FEMALE/OTHER), Ghi chú (textarea 3 rows). Nút Lưu (teal) + Hủy. Loading "Đang lưu...".

**Modal Sửa (S-2):** prefill từ `selected`; Email readonly style `bg-gray-50 text-gray-500 cursor-not-allowed`, không hint; gửi `UpdateMemberPayload` (không email). Nút Cập nhật + Hủy.

**Modal Chi tiết (S-3):** `max-w-2xl`, gọi `getMemberDetail(id)` với loading "Đang tải...". 3 mục: Thông tin cá nhân (grid), Gói tập hiện tại ("Chưa có gói tập nào" nếu rỗng), Lịch sử tập luyện ("Chưa có lịch sử tập luyện" nếu rỗng). Nút Đóng.

**Confirm Xóa (S-4):** "Bạn có chắc muốn ngừng kích hoạt hội viên này?" + tên; nút Xác nhận (đỏ) + Hủy.

### Behavior
- Sau thêm/sửa/xóa: đóng modal + reload danh sách + toast 3s (Toast component có sẵn).
- Lỗi field-level (border đỏ + text đỏ) qua `parseApiError` (import từ `api/auth`); lỗi chung → banner đỏ trên form.
- State theo đúng spec: `members`, `search`, `loading`, `modal`, `selected`, `detail`, `fieldErrors`, `formError`, `toast` (thêm `detailLoading`, `saving`, `form` cho tiện).

### Validation
- `npx tsc --noEmit` → PASS (TypeScript strict, không dùng `any`).
- `parseApiError` dùng lại pattern có sẵn trong `api/auth.ts` (không extract riêng — spec cho phép "copy pattern hoặc extract").

### Notes / TODO
- `activePackages` / `bookingHistory` hiện backend luôn trả rỗng (UC3.2/UC5.1 chưa có) → luôn hiển thị empty text; UI danh sách + status pill đã sẵn sàng khi backend nối dữ liệu.
- Rule cảnh báo gói sắp hết (sessionsRemaining ≤ 2 / endDate ≤ today+7, badge vàng) chưa hiển thị vì backend chưa gửi cờ cảnh báo — sẽ bổ sung khi UC3.2 xong.
