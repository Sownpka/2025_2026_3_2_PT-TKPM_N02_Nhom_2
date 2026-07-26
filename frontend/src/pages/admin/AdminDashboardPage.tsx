import { useEffect, useState } from 'react'
import { fetchDashboard } from '../../api/dashboard'
import type { DashboardStats } from '../../api/dashboard'

// ===== Helper định dạng VNĐ =====
const formatVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    let active = true
    fetchDashboard()
      .then((data) => {
        if (active) setStats(data)
      })
      .catch(() => {
        if (active) setStats(null)
      })
    return () => {
      active = false
    }
  }, [])

  if (!stats) {
    return <div className="text-center py-8 text-gray-400">Đang tải...</div>
  }

  const profit = stats.revenueThisMonth - stats.expenseThisMonth

  return (
    <div className="space-y-4">
      {/* Hàng 1 — 2 card lớn: thu & lợi nhuận */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-6 shadow">
          <div className="text-sm text-gray-500 mb-2">Tổng thu tháng này</div>
          <div className="text-3xl font-bold text-green-600">
            {formatVND(stats.revenueThisMonth)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow">
          <div className="text-sm text-gray-500 mb-2">Lợi nhuận</div>
          <div
            className={`text-3xl font-bold ${
              profit >= 0 ? 'text-teal-600' : 'text-red-600'
            }`}
          >
            {formatVND(profit)}
          </div>
        </div>
      </div>

      {/* Hàng 2 — 4 card nhỏ */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-5 shadow">
          <div className="text-sm text-gray-500 mb-1">Hội viên đang hoạt động</div>
          <div className="text-2xl font-bold text-gray-800">{stats.totalMembers}</div>
        </div>
        <div className="bg-white rounded-lg p-5 shadow">
          <div className="text-sm text-gray-500 mb-1">Gói tập đang hiệu lực</div>
          <div className="text-2xl font-bold text-gray-800">{stats.totalActivePackages}</div>
        </div>
        <div className="bg-white rounded-lg p-5 shadow">
          <div className="text-sm text-gray-500 mb-1">Huấn luyện viên</div>
          <div className="text-2xl font-bold text-gray-800">{stats.totalTrainers}</div>
        </div>
        <div className="bg-white rounded-lg p-5 shadow">
          <div className="text-sm text-gray-500 mb-1">Thiết bị</div>
          <div className="text-2xl font-bold text-gray-800">{stats.totalEquipment}</div>
        </div>
      </div>

      {/* Hàng 3 — 1 card: buổi học hôm nay */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white rounded-lg p-5 shadow">
          <div className="text-sm text-gray-500 mb-1">Buổi học hôm nay</div>
          <div className="text-2xl font-bold text-gray-800">{stats.sessionsTodayCount}</div>
        </div>
      </div>
    </div>
  )
}
