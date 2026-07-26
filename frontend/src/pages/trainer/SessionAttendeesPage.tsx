import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/auth'
import {
  fetchSessionAttendees,
  type BookingStatus,
  type SessionAttendeesResponse,
} from '../../api/trainerSchedule'

// Nhãn + màu pill cho trạng thái đặt
const BOOKING_PILL: Record<BookingStatus, { label: string; className: string }> = {
  BOOKED: { label: 'Đã đặt', className: 'bg-blue-100 text-blue-700' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-gray-100 text-gray-600' },
  ATTENDED: { label: 'Đã tập', className: 'bg-green-100 text-green-700' },
  NO_SHOW: { label: 'No-show', className: 'bg-red-100 text-red-700' },
}

// "yyyy-MM-dd" → "dd/MM/yyyy"
function formatSessionDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}

export default function SessionAttendeesPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams<{ sessionId: string }>()
  const [data, setData] = useState<SessionAttendeesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const id = Number(sessionId)
    if (!id) return
    setLoading(true)
    setError(null)
    fetchSessionAttendees(id)
      .then((d) => {
        if (active) setData(d)
      })
      .catch((err) => {
        if (active) setError(parseApiError(err)[0]?.message ?? 'Lỗi tải dữ liệu')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [sessionId])

  const info = data?.sessionInfo
  const isPast = info?.isPast ?? false
  const attendees = data?.attendees ?? []

  return (
    <div className="space-y-4">
      {/* Nút quay lại */}
      <button
        onClick={() => navigate('/trainer/schedule')}
        className="flex items-center gap-1 text-teal-600 hover:text-teal-800 mb-4"
      >
        ← Quay lại lịch dạy
      </button>

      {/* Header trang: tên buổi + thời gian */}
      {info && (
        <h2 className="text-lg font-semibold text-gray-800">
          {info.className} — {formatSessionDate(info.sessionDate)} {info.startTime}–
          {info.endTime}
        </h2>
      )}

      {/* Lỗi */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Đang tải...</div>
      )}

      {/* Bảng hội viên */}
      {!loading && !error && data && attendees.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">Họ tên</th>
                <th className="px-4 py-3 font-medium">SĐT</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                {isPast && <th className="px-4 py-3 font-medium">Điểm danh</th>}
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => {
                const pill = BOOKING_PILL[a.bookingStatus]
                return (
                  <tr key={a.bookingId} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-800">{a.memberName}</td>
                    <td className="px-4 py-3 text-gray-600">{a.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Pill label={pill.label} className={pill.className} />
                    </td>
                    {isPast && (
                      <td className="px-4 py-3">
                        {a.bookingStatus === 'ATTENDED' ? (
                          <Pill label="Có mặt" className="bg-green-100 text-green-700" />
                        ) : a.bookingStatus === 'NO_SHOW' ? (
                          <Pill label="No-show" className="bg-red-100 text-red-700" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* E-1 — Không có hội viên */}
      {!loading && !error && data && attendees.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Chưa có hội viên đăng ký cho buổi này
        </div>
      )}
    </div>
  )
}
