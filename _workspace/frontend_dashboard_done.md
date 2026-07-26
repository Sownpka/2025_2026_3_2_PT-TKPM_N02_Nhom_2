# Frontend — Admin Dashboard: DONE

Ngày: 2026-07-19
Người thực hiện: frontend-dev agent

## Đã hoàn thành

### 1. API call — `src/api/dashboard.ts` (mới)
- Interface `DashboardStats` (7 field theo spec: totalMembers, totalActivePackages, totalTrainers, totalEquipment, revenueThisMonth, expenseThisMonth, sessionsTodayCount).
- Hàm `fetchDashboard()` → `GET /api/dashboard`.
- **Lưu ý điều chỉnh theo convention dự án:** dùng `import client from './client'` (default export) thay vì `apiClient` như trong prompt — file `client.ts` export default, không có named export `apiClient`. Endpoint đặt trong `endpoints.ts` (`DASHBOARD.BASE = '/dashboard'`) cho nhất quán với các api file khác.

### 2. Trang — `src/pages/admin/AdminDashboardPage.tsx` (mới)
- Fetch bằng pattern `useState + useEffect + active-flag` chuẩn dự án.
- Loading state: "Đang tải..." khi chưa có data.
- Giao diện 3 hàng card:
  - Hàng 1 (2 card lớn): "Tổng thu tháng này" (text-green-600) | "Lợi nhuận" (teal nếu >=0, đỏ nếu <0), profit = revenue - expense.
  - Hàng 2 (4 card nhỏ): Hội viên đang hoạt động, Gói tập đang hiệu lực, Huấn luyện viên, Thiết bị.
  - Hàng 3 (1 card): Buổi học hôm nay.
- Format VNĐ bằng `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`.
- Card nền trắng, `shadow`, `rounded-lg`, số liệu font lớn bold — đồng bộ style với FinancePage.

### 3. `src/App.tsx`
- Import `AdminDashboardPage`.
- Thay 3 Placeholder: `/admin/dashboard` → `<AdminDashboardPage />`, `/admin/members` → `<ReceptionMembersPage />`, `/admin/attendance` → `<AttendancePage />`.
- Xóa component `Placeholder` (không còn nơi dùng → sẽ gây lỗi TS6133 nếu giữ lại).

### 4. `src/components/Layout.tsx`
- Thêm `'/admin/dashboard': 'Tổng quan'` vào `PAGE_TITLES`.

### 5. Endpoints — `src/api/endpoints.ts`
- Thêm `DASHBOARD = { BASE: '/dashboard' }`.

## Kiểm tra
- `npx tsc --noEmit` PASS (không lỗi).

## Phụ thuộc backend
- Cần endpoint `GET /api/dashboard` trả JSON đúng shape `DashboardStats` (backend agent đang làm).
