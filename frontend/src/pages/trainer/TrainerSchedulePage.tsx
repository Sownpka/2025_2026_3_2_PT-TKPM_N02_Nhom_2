import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseApiError } from '../../api/auth'
import {
  fetchTrainerSchedule,
  type BackendDayOfWeek,
  type SessionItem,
  type SessionType,
  type TrainerScheduleResponse,
} from '../../api/trainerSchedule'

// ===== Cột T2 → CN =====
const DAY_ORDER: BackendDayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]
const DAY_LABEL: Record<BackendDayOfWeek, string> = {
  MONDAY: 'T2',
  TUESDAY: 'T3',
  WEDNESDAY: 'T4',
  THURSDAY: 'T5',
  FRIDAY: 'T6',
  SATURDAY: 'T7',
  SUNDAY: 'CN',
}

// Màu card theo loại buổi
const CARD_BG: Record<SessionType, string> = {
  GROUP: 'bg-teal-50 border border-teal-200',
  PRIVATE_1_1: 'bg-blue-50 border border-blue-200',
  PRIVATE_1_2: 'bg-purple-50 border border-purple-200',
}

// ===== Week helpers (dựa trên Date của Monday) =====

// Monday của tuần hiện tại (giờ địa phương, đầu ngày)
function getThisMonday(): Date {
  const now = new Date()
  return getMondayOfDate(now)
}

// Monday của tuần chứa ngày d
function getMondayOfDate(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = date.getDay() || 7 // CN = 0 → 7
  date.setDate(date.getDate() - (day - 1))
  return date
}

// Cộng n tuần (n có thể âm)
function addWeeks(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n * 7)
  return d
}

// Cộng n ngày
function addDays(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

// ISO week string "YYYY-Www" từ Monday
function getISOWeekString(monday: Date): string {
  // Thứ Năm của tuần ISO quyết định năm & số tuần
  const thursday = addDays(monday, 3)
  const year = thursday.getFullYear()
  const yearStart = new Date(year, 0, 1)
  const diffDays = Math.round(
    (thursday.getTime() - yearStart.getTime()) / 86400000
  )
  const weekNo = Math.floor(diffDays / 7) + 1
  return `${year}-W${String(weekNo).padStart(2, '0')}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// "dd/MM"
function fmtDayMonth(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
}

// "dd/MM – dd/MM/yyyy"
function formatWeekLabel(monday: Date): string {
  const sunday = addDays(monday, 6)
  return `${fmtDayMonth(monday)} – ${pad2(sunday.getDate())}/${pad2(
    sunday.getMonth() + 1
  )}/${sunday.getFullYear()}`
}

export default function TrainerSchedulePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<TrainerScheduleResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weekMonday, setWeekMonday] = useState<Date>(() => getThisMonday())

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const weekStr = getISOWeekString(weekMonday)
    fetchTrainerSchedule(weekStr)
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
  }, [weekMonday])

  // Nhóm sessions theo thứ + sắp xếp theo startTime
  const sessionsByDay = (day: BackendDayOfWeek): SessionItem[] => {
    if (!data) return []
    return data.sessions
      .filter((s) => s.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  const isEmpty = !!data && data.sessions.length === 0 && !loading

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        {/* Điều hướng tuần */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => setWeekMonday(addWeeks(weekMonday, -1))}
            disabled={loading}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            ← Tuần trước
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[220px] text-center">
            Tuần {formatWeekLabel(weekMonday)}
          </span>
          <button
            onClick={() => setWeekMonday(addWeeks(weekMonday, 1))}
            disabled={loading}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Tuần sau →
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {/* Lưới 7 cột T2 → CN */}
        <div className="grid grid-cols-7 gap-2">
          {DAY_ORDER.map((day, i) => {
            const colDate = addDays(weekMonday, i)
            return (
              <div key={day} className="min-h-[120px]">
                <div className="text-center pb-2 border-b border-gray-200 mb-2">
                  <div className="text-xs font-semibold text-gray-600">
                    {DAY_LABEL[day]}
                  </div>
                  <div className="text-[11px] text-gray-400">{fmtDayMonth(colDate)}</div>
                </div>
                <div>
                  {sessionsByDay(day).map((session) => (
                    <div
                      key={session.sessionId}
                      className={`rounded-lg p-3 cursor-pointer hover:opacity-80 mb-2 ${
                        CARD_BG[session.type]
                      }`}
                      onClick={() =>
                        navigate(`/trainer/session/${session.sessionId}/attendees`)
                      }
                    >
                      <div className="font-semibold text-sm break-words">
                        {session.className}
                      </div>
                      <div className="text-xs text-gray-600">
                        {session.startTime}–{session.endTime}
                      </div>
                      <div className="text-xs text-gray-500">
                        {session.bookedCount}/{session.capacity}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* E-1 — Tuần trống */}
          {isEmpty && (
            <div className="col-span-7 text-center py-12 text-gray-400">
              Chưa có lịch dạy trong tuần này
            </div>
          )}
        </div>

        {loading && (
          <div className="text-center py-4 text-gray-400 text-sm">Đang tải lịch...</div>
        )}
      </div>
    </div>
  )
}
