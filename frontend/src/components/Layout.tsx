import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Tổng quan',
  '/admin/accounts': 'Quản lý tài khoản người dùng',
  '/admin/members': 'Quản lý hội viên',
  '/admin/package-types': 'Loại gói tập',
  '/admin/classes': 'Quản lý lớp học',
  '/admin/attendance': 'Điểm danh',
  '/admin/equipment': 'Quản lý thiết bị',
  '/admin/trainers': 'Quản lý Huấn luyện viên',
  '/admin/notifications': 'Lịch sử thông báo',
  '/admin/finance': 'Tài chính',
  '/reception/members': 'Quản lý hội viên',
  '/reception/register-package': 'Đăng ký gói tập',
  '/reception/attendance': 'Điểm danh hôm nay',
  '/member/booking': 'Đặt lịch tập',
  '/member/my-bookings': 'Lịch tập của tôi',
  '/member/history': 'Gói tập & Lịch sử tập luyện',
  '/member/private-booking': 'Đăng ký buổi 1-1/1-2',
  '/trainer/schedule': 'Lịch dạy của tôi',
}

export default function Layout() {
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'PiCore'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={pageTitle} />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
