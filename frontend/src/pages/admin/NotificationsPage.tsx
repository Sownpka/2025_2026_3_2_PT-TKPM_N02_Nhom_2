import { useEffect, useState } from 'react'
import {
  fetchNotifications,
  type NotificationPage,
  type NotificationType,
  type NotificationStatus,
  type NotificationChannel,
} from '../../api/notifications'
import { parseApiError } from '../../api/auth'

const PAGE_SIZE = 20

// ===== Nhãn + pill cho Loại thông báo =====
const TYPE_PILL: Record<NotificationType, { className: string; label: string }> = {
  CONFIRM: { className: 'bg-blue-100 text-blue-700', label: 'Xác nhận đặt lịch' },
  REMINDER: { className: 'bg-yellow-100 text-yellow-800', label: 'Nhắc lịch' },
  WAITLIST_INVITE: { className: 'bg-purple-100 text-purple-700', label: 'Mời từ DS chờ' },
  ACTIVATION: { className: 'bg-gray-100 text-gray-600', label: 'Kích hoạt TK' },
}

// ===== Nhãn + pill cho Trạng thái =====
const STATUS_PILL: Record<NotificationStatus, { className: string; label: string }> = {
  SENT: { className: 'bg-green-100 text-green-800', label: 'Đã gửi' },
  FAILED: { className: 'bg-red-100 text-red-700', label: 'Thất bại' },
}

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
}

// Dropdown Loại (option đầu = tất cả)
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'CONFIRM', label: 'Xác nhận đặt lịch' },
  { value: 'REMINDER', label: 'Nhắc lịch' },
  { value: 'WAITLIST_INVITE', label: 'Mời từ danh sách chờ' },
  { value: 'ACTIVATION', label: 'Kích hoạt tài khoản' },
]

// Dropdown Trạng thái
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'SENT', label: 'Đã gửi' },
  { value: 'FAILED', label: 'Thất bại' },
]

// ISO datetime → "dd/MM/yyyy HH:mm"
function formatSentAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(0)

  // Re-fetch khi filter/page đổi (active-flag chống race)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetchNotifications({
      type: filterType || undefined,
      status: filterStatus || undefined,
      page,
      size: PAGE_SIZE,
    })
      .then((d) => {
        if (active) setData(d)
      })
      .catch((err) => {
        if (active) setError(parseApiError(err)[0].message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [filterType, filterStatus, page])

  // Đổi filter → về trang đầu
  function handleTypeChange(value: string) {
    setFilterType(value)
    setPage(0)
  }

  function handleStatusChange(value: string) {
    setFilterStatus(value)
    setPage(0)
  }

  const items = data?.content ?? []
  const totalPages = data?.totalPages ?? 0
  const showPagination = totalPages > 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-800">Lịch sử thông báo</h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4 bg-white rounded-lg shadow px-5 py-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Loại
          </label>
          <select
            value={filterType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Trạng thái
          </label>
          <select
            value={filterStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Bảng */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Thời gian', 'Hội viên', 'Loại', 'Kênh', 'Nội dung', 'Trạng thái'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((n) => {
                const typePill = TYPE_PILL[n.type]
                const statusPill = STATUS_PILL[n.status]
                const isFailed = n.status === 'FAILED'
                return (
                  <tr
                    key={n.id}
                    className={isFailed ? 'bg-red-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatSentAt(n.sentAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                      {n.memberName ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                          typePill?.className ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {typePill?.label ?? n.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {CHANNEL_LABEL[n.channel] ?? n.channel}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
                      {n.content}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusPill?.className ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {statusPill?.label ?? n.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {loading && (
            <div className="text-center py-8 text-gray-400">Đang tải...</div>
          )}
          {!loading && items.length === 0 && !error && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Chưa có thông báo nào được ghi nhận
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Trang {page + 1} / {totalPages}
          </div>
          <div className="inline-flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page <= 0 || loading}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sau →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
