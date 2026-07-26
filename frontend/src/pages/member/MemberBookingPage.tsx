import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import {
  fetchTimetable,
  createBooking,
  joinWaitlist,
} from '../../api/bookings'
import { fetchMyPackages, type MyPackageResponse } from '../../api/me'
import { parseApiError } from '../../api/auth'
import type { PackageCategory } from '../../types'
import type { TimetableResponse, TimetableSession } from '../../types/class'
import type { DayOfWeek } from '../../types/trainer'

type ToastType = 'success' | 'error'

// ===== Cột T2 → CN =====
const DAY_ORDER: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_LABEL: Record<DayOfWeek, string> = {
  MON: 'T2',
  TUE: 'T3',
  WED: 'T4',
  THU: 'T5',
  FRI: 'T6',
  SAT: 'T7',
  SUN: 'CN',
}

// Gói tính theo số buổi (phần còn lại là gói không giới hạn)
const SESSION_CATEGORIES = new Set<PackageCategory>(['THEO_BUOI', 'GOI_1_1', 'GOI_1_2'])

// "08:00:00" → "08:00"
function hhmm(t: string): string {
  return t ? t.slice(0, 5) : ''
}

// ===== ISO week helpers (không cần library) =====
function parseWeek(week: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week)
  if (!m) return null
  return { year: Number(m[1]), week: Number(m[2]) }
}

function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayNum = jan4.getUTCDay() || 7
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayNum - 1))
  const target = new Date(mondayWeek1)
  target.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7)
  return target
}

function toISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function shiftWeek(week: string, delta: number): string {
  const parsed = parseWeek(week)
  if (!parsed) return week
  const monday = mondayOfISOWeek(parsed.year, parsed.week)
  monday.setUTCDate(monday.getUTCDate() + delta * 7)
  return toISOWeek(monday)
}

function fmtDayMonth(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function weekLabel(week: string): string {
  const parsed = parseWeek(week)
  if (!parsed) return ''
  const monday = mondayOfISOWeek(parsed.year, parsed.week)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return `Tuần ${fmtDayMonth(monday)} – ${fmtDayMonth(sunday)}`
}

// dd/MM cho từng cột theo thứ trong tuần
function weekDayDates(week: string): Record<DayOfWeek, string> {
  const map = {} as Record<DayOfWeek, string>
  const parsed = parseWeek(week)
  if (!parsed) return map
  const monday = mondayOfISOWeek(parsed.year, parsed.week)
  DAY_ORDER.forEach((day, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    map[day] = fmtDayMonth(d)
  })
  return map
}

// Ngày hôm nay dạng "yyyy-MM-dd" (so sánh với sessionDate)
function todayISODate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

function sessionsLabel(pkg: MyPackageResponse): string {
  if (SESSION_CATEGORIES.has(pkg.category) && pkg.sessionsRemaining != null) {
    return `Còn ${pkg.sessionsRemaining} buổi`
  }
  return 'Không giới hạn buổi'
}

export default function MemberBookingPage() {
  const navigate = useNavigate()
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null)
  const [loading, setLoading] = useState(false)

  // Gói tập của tôi (khối tóm tắt + chọn khi đặt)
  const [packages, setPackages] = useState<MyPackageResponse[]>([])
  const [packagesLoaded, setPackagesLoaded] = useState(false)

  // Modal xác nhận đặt chỗ
  const [confirmSession, setConfirmSession] = useState<TimetableSession | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [booking, setBooking] = useState(false)

  // Dialog danh sách chờ (E-1)
  const [waitlistSession, setWaitlistSession] = useState<TimetableSession | null>(null)
  const [joiningWaitlist, setJoiningWaitlist] = useState(false)

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  // E-3: hiển thị hint điều hướng đến "Lịch tập của tôi" sau lỗi đã đặt
  const [showAlreadyBookedHint, setShowAlreadyBookedHint] = useState(false)

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const loadTimetable = useCallback(
    async (week?: string) => {
      setLoading(true)
      try {
        const data = await fetchTimetable(week)
        setTimetable(data)
      } catch (err) {
        showToast(parseApiError(err)[0].message, 'error')
      } finally {
        setLoading(false)
      }
    },
    [showToast]
  )

  useEffect(() => {
    void loadTimetable()
  }, [loadTimetable])

  const loadPackages = useCallback(async () => {
    try {
      const data = await fetchMyPackages()
      setPackages(data)
      setPackagesLoaded(true)
      return data
    } catch (err) {
      showToast(parseApiError(err)[0].message, 'error')
      return [] as MyPackageResponse[]
    }
  }, [showToast])

  // Nạp gói tập ngay khi mở trang (dùng cho khối tóm tắt bên phải)
  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  const activePackages = useMemo(
    () => packages.filter((p) => p.status === 'ACTIVE'),
    [packages]
  )

  function changeWeek(delta: number) {
    if (!timetable) return
    void loadTimetable(shiftWeek(timetable.week, delta))
  }

  const dayDates = useMemo(
    () => (timetable ? weekDayDates(timetable.week) : ({} as Record<DayOfWeek, string>)),
    [timetable]
  )
  const today = todayISODate()

  async function openConfirm(session: TimetableSession) {
    setConfirmSession(session)
    // Đảm bảo có gói mới nhất trước khi chọn
    const list = packagesLoaded ? packages : await loadPackages()
    const active = list.filter((p) => p.status === 'ACTIVE')
    // 1 gói ACTIVE → tự chọn; nhiều gói → để trống chờ chọn
    setSelectedPackageId(active.length === 1 ? String(active[0].id) : '')
  }

  function closeConfirm() {
    setConfirmSession(null)
    setSelectedPackageId('')
  }

  async function handleConfirmBooking() {
    if (!confirmSession || !selectedPackageId) return
    setBooking(true)
    try {
      await createBooking({
        classSessionId: confirmSession.sessionId,
        memberPackageId: Number(selectedPackageId),
      })
      closeConfirm()
      showToast('Đặt lịch thành công!', 'success')
      await Promise.all([loadTimetable(timetable?.week), loadPackages()])
    } catch (err) {
      const status = (err as AxiosError).response?.status
      const message = parseApiError(err)[0].message
      if (status === 409 && message.includes('đầy')) {
        // Lớp đã đầy → chuyển sang dialog danh sách chờ (E-1)
        const full = confirmSession
        closeConfirm()
        setWaitlistSession(full)
      } else if (status === 409 && message.includes('đã đặt lịch')) {
        // E-3: đã đặt buổi này → đóng modal, show toast + link điều hướng
        closeConfirm()
        showToast(message, 'error')
        setShowAlreadyBookedHint(true)
        await loadTimetable(timetable?.week)
      } else {
        // "chưa có gói" / lỗi khác → toast + refresh
        closeConfirm()
        showToast(message, 'error')
        await loadTimetable(timetable?.week)
      }
    } finally {
      setBooking(false)
    }
  }

  async function handleJoinWaitlist() {
    if (!waitlistSession) return
    setJoiningWaitlist(true)
    try {
      await joinWaitlist(waitlistSession.sessionId)
      setWaitlistSession(null)
      showToast('Đã vào danh sách chờ', 'success')
    } catch (err) {
      showToast(parseApiError(err)[0].message, 'error')
    } finally {
      setJoiningWaitlist(false)
    }
  }

  const selectedPackage = activePackages.find((p) => String(p.id) === selectedPackageId)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-800">Đặt lịch tập</h1>

      {/* E-3 hint: đã đặt buổi này → link tới Lịch tập của tôi (Hình 62) */}
      {showAlreadyBookedHint && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-blue-800">Bạn đã đặt lịch cho buổi học này.</span>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/member/my-bookings')}
              className="text-teal-600 font-medium hover:underline"
            >
              Xem lịch tập của tôi →
            </button>
            <button
              onClick={() => setShowAlreadyBookedHint(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {/* ===== Lưới thời khóa biểu ===== */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow p-4">
          {/* Điều hướng tuần */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => changeWeek(-1)}
              disabled={!timetable || loading}
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              aria-label="Tuần trước"
            >
              ←
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
              {timetable ? weekLabel(timetable.week) : 'Đang tải...'}
            </span>
            <button
              onClick={() => changeWeek(1)}
              disabled={!timetable || loading}
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              aria-label="Tuần sau"
            >
              →
            </button>
          </div>

          {/* Lưới 7 cột */}
          <div className="grid grid-cols-7 gap-2">
            {DAY_ORDER.map((day) => {
              const daySessions = timetable
                ? timetable.sessions.filter((s) => s.dayOfWeek === day)
                : []
              return (
                <div key={day} className="min-h-[120px]">
                  <div className="text-center pb-2 border-b border-gray-200 mb-2">
                    <div className="text-xs font-semibold text-gray-600">{DAY_LABEL[day]}</div>
                    <div className="text-[11px] text-gray-400">{dayDates[day] ?? ''}</div>
                  </div>
                  <div className="space-y-2">
                    {daySessions.map((s) => (
                      <BookingCard
                        key={s.sessionId}
                        session={s}
                        today={today}
                        onBook={() => void openConfirm(s)}
                        onWaitlist={() => setWaitlistSession(s)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {loading && (
            <div className="text-center py-4 text-gray-400 text-sm">Đang tải lịch...</div>
          )}
          {!loading && timetable && timetable.sessions.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              Chưa có lớp nào trong tuần này.
            </div>
          )}
        </div>

        {/* ===== Khối gói tập của tôi ===== */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <h2 className="font-semibold text-gray-800">Gói tập của tôi</h2>
            {activePackages.length === 0 ? (
              <p className="text-sm text-gray-500">
                Bạn chưa có gói tập còn hiệu lực. Vui lòng liên hệ lễ tân để đăng ký.
              </p>
            ) : (
              <ul className="space-y-2">
                {activePackages.map((p) => (
                  <li key={p.id} className="border border-gray-100 rounded p-2">
                    <div className="text-sm font-medium text-gray-800">{p.packageTypeName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{sessionsLabel(p)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ===== Modal xác nhận đặt chỗ (Hình 59) ===== */}
      {confirmSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Xác nhận đặt chỗ</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Chi tiết buổi */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Lớp học</span>
                  <span className="font-medium text-gray-800">{confirmSession.className}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Huấn luyện viên</span>
                  <span className="text-gray-700">{confirmSession.trainerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ngày</span>
                  <span className="text-gray-700">{formatDate(confirmSession.sessionDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Giờ</span>
                  <span className="text-gray-700">
                    {hhmm(confirmSession.startTime)} – {hhmm(confirmSession.endTime)}
                  </span>
                </div>
              </div>

              {activePackages.length === 0 ? (
                // E-2 — không có gói hiệu lực
                <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 text-sm">
                  Bạn chưa có gói tập còn hiệu lực. Vui lòng liên hệ lễ tân để đăng ký gói tập
                  trước khi đặt lịch.
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chọn gói tập
                  </label>
                  {activePackages.length === 1 ? (
                    <div className="text-sm text-gray-800 border border-gray-200 rounded px-3 py-2 bg-gray-50">
                      {activePackages[0].packageTypeName}
                    </div>
                  ) : (
                    <select
                      value={selectedPackageId}
                      onChange={(e) => setSelectedPackageId(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="">-- Chọn gói tập --</option>
                      {activePackages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.packageTypeName} ({sessionsLabel(p)})
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedPackage && (
                    <p className="text-xs text-gray-500 mt-2">
                      {SESSION_CATEGORIES.has(selectedPackage.category) &&
                      selectedPackage.sessionsRemaining != null
                        ? `Sau khi đặt: còn ${Math.max(
                            selectedPackage.sessionsRemaining - 1,
                            0
                          )} buổi`
                        : 'Gói không giới hạn số buổi'}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleConfirmBooking()}
                disabled={booking || !selectedPackageId}
                className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {booking ? 'Đang đặt...' : 'Xác nhận đặt chỗ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== E-1 — Dialog danh sách chờ (Hình 60) ===== */}
      {waitlistSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Lớp học đã đầy</h2>
              <p className="text-gray-700 text-sm">
                Lớp học đã đầy. Bạn có muốn vào danh sách chờ không? Chúng tôi sẽ thông báo nếu có
                chỗ trống.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {waitlistSession.className} — {formatDate(waitlistSession.sessionDate)}{' '}
                {hhmm(waitlistSession.startTime)}
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                onClick={() => setWaitlistSession(null)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
              >
                Không, cảm ơn
              </button>
              <button
                onClick={() => void handleJoinWaitlist()}
                disabled={joiningWaitlist}
                className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {joiningWaitlist ? 'Đang xử lý...' : 'Vào danh sách chờ'}
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

// "yyyy-MM-dd" → "dd/MM/yyyy"
function formatDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

// Trả true khi còn dưới 30 phút tới giờ bắt đầu (hoặc đã bắt đầu)
function isSessionLocked(sessionDate: string, startTime: string): boolean {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (sessionDate !== todayStr) return false
  const [h, m] = startTime.split(':').map(Number)
  const cutoff = new Date()
  cutoff.setHours(h, m, 0, 0)
  cutoff.setMinutes(cutoff.getMinutes() - 30)
  return now >= cutoff
}

interface BookingCardProps {
  session: TimetableSession
  today: string
  onBook: () => void
  onWaitlist: () => void
}

function BookingCard({ session, today, onBook, onWaitlist }: BookingCardProps) {
  const status = session.myBookingStatus
  const isPast = session.sessionDate < today
  const isLocked = !isPast && isSessionLocked(session.sessionDate, session.startTime)
  const full = session.availableSpots <= 0

  return (
    <div className="bg-teal-50 border border-teal-200 rounded p-2 text-xs">
      <div className="font-semibold text-teal-800 break-words">{session.className}</div>
      <div className="text-teal-600 mt-0.5">HLV: {session.trainerName}</div>
      <div className="text-teal-600 mt-0.5">
        {hhmm(session.startTime)} – {hhmm(session.endTime)}
      </div>
      <div className="text-gray-500 mt-0.5">
        Còn: {session.availableSpots}/{session.capacity} chỗ
      </div>

      <div className="mt-1.5">
        {status === 'ATTENDED' ? (
          <span className="inline-flex px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
            Đã tập
          </span>
        ) : status === 'BOOKED' ? (
          <span className="inline-flex px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
            Đã đặt
          </span>
        ) : isPast ? (
          <button
            disabled
            className="w-full px-2 py-1 rounded bg-gray-100 text-gray-400 font-medium cursor-not-allowed"
          >
            Đã qua
          </button>
        ) : isLocked ? (
          <button
            disabled
            className="w-full px-2 py-1 rounded bg-orange-100 text-orange-600 font-medium cursor-not-allowed"
            title="Đặt chỗ đã đóng trước 30 phút"
          >
            🔒 Đã khóa
          </button>
        ) : full ? (
          <button
            onClick={onWaitlist}
            className="w-full px-2 py-1 rounded bg-gray-200 text-gray-600 font-medium hover:bg-gray-300"
          >
            Hết chỗ
          </button>
        ) : (
          <button
            onClick={onBook}
            className="w-full px-2 py-1 rounded bg-teal-600 text-white font-medium hover:bg-teal-700"
          >
            Đặt chỗ
          </button>
        )}
      </div>
    </div>
  )
}
