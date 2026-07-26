import { useCallback, useEffect, useState } from 'react'
import {
  fetchTodaySessions,
  fetchAttendees,
  checkIn,
  markNoShow,
  type SessionSummary,
  type AttendeeItem,
  type AttendeeBookingStatus,
  type QuickCheckinResponse,
} from '../../api/attendance'
import { parseApiError } from '../../api/auth'
import QuickCheckinDialog from './QuickCheckinDialog'

type ToastType = 'success' | 'error'

const STATUS_PILL: Record<AttendeeBookingStatus, { className: string; label: string }> = {
  BOOKED: { className: 'bg-blue-100 text-blue-700', label: 'Chờ điểm danh' },
  ATTENDED: { className: 'bg-green-100 text-green-800', label: 'Đã có mặt' },
  NO_SHOW: { className: 'bg-red-100 text-red-700', label: 'No-show' },
  CANCELLED: { className: 'bg-gray-100 text-gray-600', label: 'Đã hủy' },
}

const WEEKDAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
]

// Date → "Thứ Sáu, 18/07/2026"
function formatTodayLabel(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${WEEKDAYS[d.getDay()]}, ${dd}/${mm}/${yyyy}`
}

export default function AttendancePage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null)
  const [attendees, setAttendees] = useState<AttendeeItem[]>([])

  const [loading, setLoading] = useState(false)
  const [loadingAttendees, setLoadingAttendees] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showQuickCheckin, setShowQuickCheckin] = useState(false)
  // bookingId đang xử lý check-in/no-show → disable nút để tránh double click
  const [processingId, setProcessingId] = useState<number | null>(null)

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  // Tải danh sách buổi hôm nay khi mount
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetchTodaySessions()
      .then((data) => {
        if (active) setSessions(data)
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
  }, [])

  // Tải hội viên mỗi khi đổi buổi đang chọn
  useEffect(() => {
    if (!selectedSession) {
      setAttendees([])
      return
    }
    let active = true
    const sessionId = selectedSession.sessionId
    setLoadingAttendees(true)
    fetchAttendees(sessionId)
      .then((data) => {
        if (active) setAttendees(data)
      })
      .catch((err) => {
        if (active) {
          setAttendees([])
          showToast(parseApiError(err)[0].message, 'error')
        }
      })
      .finally(() => {
        if (active) setLoadingAttendees(false)
      })
    return () => {
      active = false
    }
  }, [selectedSession, showToast])

  async function handleCheckIn(bookingId: number) {
    if (!selectedSession) return
    setProcessingId(bookingId)
    try {
      await checkIn(bookingId)
      setAttendees((prev) =>
        prev.map((a) =>
          a.bookingId === bookingId ? { ...a, bookingStatus: 'ATTENDED' } : a
        )
      )
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === selectedSession.sessionId
            ? { ...s, checkedInCount: s.checkedInCount + 1 }
            : s
        )
      )
      setSelectedSession((prev) =>
        prev ? { ...prev, checkedInCount: prev.checkedInCount + 1 } : prev
      )
      showToast('Đã điểm danh có mặt', 'success')
    } catch (err) {
      showToast(parseApiError(err)[0].message, 'error')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleNoShow(bookingId: number) {
    if (!selectedSession) return
    setProcessingId(bookingId)
    try {
      await markNoShow(bookingId)
      setAttendees((prev) =>
        prev.map((a) =>
          a.bookingId === bookingId ? { ...a, bookingStatus: 'NO_SHOW' } : a
        )
      )
      showToast('Đã đánh dấu vắng mặt (no-show)', 'success')
    } catch (err) {
      showToast(parseApiError(err)[0].message, 'error')
    } finally {
      setProcessingId(null)
    }
  }

  function handleQuickSuccess(result: QuickCheckinResponse) {
    setShowQuickCheckin(false)
    const remaining =
      result.sessionsRemaining === null ? '∞' : `${result.sessionsRemaining}`
    showToast(
      `Điểm danh thành công cho ${result.memberName}. Còn ${remaining} buổi.`,
      'success'
    )
    // Walk-in không gắn buổi nào trong danh sách → không cần refetch attendees.
  }

  const todayLabel = formatTodayLabel(new Date())

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Điểm danh hôm nay</h1>
          <p className="text-sm text-gray-500 capitalize">{todayLabel}</p>
        </div>
        <button
          onClick={() => setShowQuickCheckin(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Điểm danh nhanh
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Panel trái — danh sách buổi */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
            Buổi học hôm nay
          </h2>

          {loading && <div className="text-center py-8 text-gray-400">Đang tải...</div>}

          {!loading && sessions.length === 0 && !error && (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">
              Không có buổi học nào hôm nay
            </div>
          )}

          {!loading &&
            sessions.map((s) => {
              const active = selectedSession?.sessionId === s.sessionId
              return (
                <button
                  key={s.sessionId}
                  onClick={() => setSelectedSession(s)}
                  className={`w-full text-left bg-white rounded-lg shadow p-4 border-l-4 transition-colors ${
                    active
                      ? 'border-teal-600 ring-1 ring-teal-500'
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-800">
                    {s.startTime} – {s.endTime}
                  </div>
                  <div className="text-sm text-gray-700 mt-0.5">{s.className}</div>
                  <div className="text-xs text-gray-500 mt-0.5">HLV: {s.trainerName}</div>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-teal-50">
                      {s.checkedInCount}/{s.bookedCount} đã điểm danh
                    </span>
                  </div>
                </button>
              )
            })}
        </div>

        {/* Panel phải — danh sách hội viên */}
        <div className="lg:col-span-2">
          {!selectedSession ? (
            <div className="bg-white rounded-lg shadow p-10 text-center text-gray-500 text-sm h-full flex items-center justify-center">
              Chọn một buổi học để xem danh sách hội viên
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              {/* Đầu panel */}
              <div className="px-5 py-4 border-b">
                <div className="text-base font-semibold text-gray-800">
                  {selectedSession.className}{' '}
                  <span className="text-gray-400 font-normal">— {selectedSession.trainerName}</span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {selectedSession.startTime} – {selectedSession.endTime} ·{' '}
                  {selectedSession.checkedInCount}/{selectedSession.bookedCount} đã điểm danh
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Họ tên', 'Gói tập', 'Còn lại', 'Trạng thái'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {attendees.map((a) => {
                      const pill = STATUS_PILL[a.bookingStatus]
                      const isBooked = a.bookingStatus === 'BOOKED'
                      const busy = processingId === a.bookingId
                      return (
                        <tr key={a.bookingId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-800">{a.memberName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {a.packageTypeName ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {a.sessionsRemaining === null
                              ? '∞'
                              : `${a.sessionsRemaining} buổi`}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${pill.className}`}
                            >
                              {pill.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {isBooked ? (
                              <div className="inline-flex gap-2">
                                <button
                                  onClick={() => void handleCheckIn(a.bookingId)}
                                  disabled={busy}
                                  className="text-white px-3 py-1 rounded text-xs font-medium bg-[#22C55E] hover:brightness-95 disabled:opacity-50"
                                >
                                  {busy ? '...' : 'Có mặt'}
                                </button>
                                <button
                                  onClick={() => void handleNoShow(a.bookingId)}
                                  disabled={busy}
                                  className="text-white px-3 py-1 rounded text-xs font-medium bg-[#EF4444] hover:brightness-95 disabled:opacity-50"
                                >
                                  {busy ? '...' : 'No-show'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Đã xử lý</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {loadingAttendees && (
                  <div className="text-center py-8 text-gray-400">Đang tải...</div>
                )}
                {!loadingAttendees && attendees.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Chưa có hội viên đăng ký cho buổi này
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showQuickCheckin && (
        <QuickCheckinDialog
          onClose={() => setShowQuickCheckin(false)}
          onSuccess={handleQuickSuccess}
        />
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
