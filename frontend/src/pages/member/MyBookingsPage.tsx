import { useCallback, useEffect, useState } from 'react'
import {
  fetchMyBookings,
  cancelBooking,
  type MyBookingItem,
  type MyBookingFilter,
  type MyBookingStatus,
} from '../../api/bookings'
import { parseApiError } from '../../api/auth'

type ToastType = 'success' | 'error'

const TABS: { value: MyBookingFilter; label: string; empty: string }[] = [
  { value: 'UPCOMING', label: 'Sắp diễn ra', empty: 'Bạn chưa có lịch tập nào sắp diễn ra' },
  { value: 'COMPLETED', label: 'Đã hoàn thành', empty: 'Chưa có buổi tập nào được ghi nhận' },
  { value: 'CANCELLED', label: 'Đã hủy', empty: 'Chưa có lịch hủy nào' },
]

const STATUS_PILL: Record<MyBookingStatus, { className: string; label: string }> = {
  BOOKED: { className: 'bg-blue-100 text-blue-700', label: 'Đã đặt' },
  ATTENDED: { className: 'bg-green-100 text-green-800', label: 'Đã tập' },
  CANCELLED: { className: 'bg-red-100 text-red-700', label: 'Đã hủy' },
  NO_SHOW: { className: 'bg-gray-100 text-gray-600', label: 'Vắng mặt' },
}

// "yyyy-MM-dd" → "dd/MM/yyyy"
function formatDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

// "HH:mm:ss" → "HH:mm"
function formatTime(time: string): string {
  return time.slice(0, 5)
}

export default function MyBookingsPage() {
  const [tab, setTab] = useState<MyBookingFilter>('UPCOMING')
  const [items, setItems] = useState<MyBookingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Dialog xác nhận hủy
  const [cancelTarget, setCancelTarget] = useState<MyBookingItem | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const loadBookings = useCallback(
    async (status: MyBookingFilter) => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchMyBookings(status)
        setItems(data)
      } catch (err) {
        setItems([])
        setError(parseApiError(err)[0].message)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void loadBookings(tab)
  }, [tab, loadBookings])

  async function handleConfirmCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await cancelBooking(cancelTarget.bookingId)
      setCancelTarget(null)
      showToast('Hủy lịch thành công, 1 buổi đã được hoàn trả', 'success')
      await loadBookings(tab)
    } catch (err) {
      setCancelTarget(null)
      showToast(parseApiError(err)[0].message, 'error')
    } finally {
      setCancelling(false)
    }
  }

  const activeTab = TABS.find((t) => t.value === tab)!

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-800">Lịch tập của tôi</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.value
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Ngày', 'Lớp học', 'Huấn luyện viên', 'Giờ', 'Trạng thái'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
              {tab === 'UPCOMING' && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Thao tác
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => {
              const pill = STATUS_PILL[item.bookingStatus]
              return (
                <tr key={item.bookingId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                    {formatDate(item.sessionDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">{item.className}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.trainerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {formatTime(item.startTime)} – {formatTime(item.endTime)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        pill?.className ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {pill?.label ?? item.bookingStatus}
                    </span>
                  </td>
                  {tab === 'UPCOMING' && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setCancelTarget(item)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium"
                      >
                        Hủy
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {loading && <div className="text-center py-8 text-gray-400">Đang tải...</div>}
        {!loading && items.length === 0 && !error && (
          <div className="text-center py-8 text-gray-500">{activeTab.empty}</div>
        )}
      </div>

      {/* Dialog xác nhận hủy */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <p className="text-gray-800">
                Bạn có chắc muốn hủy lịch tập này không? 1 buổi sẽ được hoàn trả.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {cancelTarget.className} — {formatDate(cancelTarget.sessionDate)}{' '}
                {formatTime(cancelTarget.startTime)}
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
              >
                Giữ lịch
              </button>
              <button
                onClick={() => void handleConfirmCancel()}
                disabled={cancelling}
                className="px-4 py-2 rounded bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              >
                {cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 text-white px-4 py-3 rounded shadow-lg text-sm ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
