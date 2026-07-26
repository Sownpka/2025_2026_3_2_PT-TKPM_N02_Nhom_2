import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import type { Role } from '../types'

interface MenuItem {
  label: string
  path: string
}

const MENU_BY_ROLE: Record<Role, MenuItem[]> = {
  ADMIN: [
    { label: 'Tổng quan', path: '/admin/dashboard' },
    { label: 'Tài khoản', path: '/admin/accounts' },
    { label: 'Hội viên', path: '/admin/members' },
    { label: 'Gói tập', path: '/admin/package-types' },
    { label: 'Lớp học', path: '/admin/classes' },
    { label: 'Điểm danh', path: '/admin/attendance' },
    { label: 'Thiết bị', path: '/admin/equipment' },
    { label: 'Huấn luyện viên', path: '/admin/trainers' },
    { label: 'Thông báo', path: '/admin/notifications' },
    { label: 'Tài chính', path: '/admin/finance' },
  ],
  RECEPTIONIST: [
    { label: 'Hội viên', path: '/reception/members' },
    { label: 'Đăng ký gói tập', path: '/reception/register-package' },
    { label: 'Lớp học', path: '/admin/classes' },
    { label: 'Điểm danh', path: '/reception/attendance' },
  ],
  TRAINER: [{ label: 'Lịch dạy', path: '/trainer/schedule' }],
  MEMBER: [
    { label: 'Đặt lịch', path: '/member/booking' },
    { label: 'Lịch tập của tôi', path: '/member/my-bookings' },
    { label: 'Gói tập & Lịch sử', path: '/member/history' },
    { label: 'Buổi 1-1/1-2', path: '/member/private-booking' },
  ],
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.role)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const items = role ? MENU_BY_ROLE[role] : []

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0F3D3E] text-white flex flex-col h-screen">
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <span className="text-xl">
          <span className="text-teal-400 font-bold">Pi</span>
          <span className="font-bold">Core</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {items.map((item) => {
          const active = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full text-left px-6 py-2.5 text-sm transition-colors border-l-4 ${
                active
                  ? 'bg-[#134E4A] border-teal-400 font-medium'
                  : 'border-transparent hover:bg-[#134E4A]'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full text-left px-2 py-2 text-sm text-gray-200 hover:bg-[#134E4A] rounded transition-colors"
        >
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}
