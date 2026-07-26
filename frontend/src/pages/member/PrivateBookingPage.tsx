import { useCallback, useEffect, useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import {
  fetchPrivateSlots,
  createPrivateBooking,
  type PrivateSlotsResponse,
  type SlotEntry,
} from '../../api/privateBooking'
import { fetchMyPackages, type MyPackageResponse } from '../../api/me'
import { parseApiError } from '../../api/auth'
import type { PackageCategory } from '../../types'
import type { DayOfWeek } from '../../types/trainer'

type ToastType = 'success' | 'error'

// Các category gói 1-1 / 1-2 hợp lệ cho UC5.2
const PRIVATE_CATEGORIES = new Set<PackageCategory>(['GOI_1_1', 'GOI_1_2'])

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

// "yyyy-MM-dd" → "dd/MM/yyyy"
function fmtDate(s: string): string {
  const parts = s.split('-')
  if (parts.length !== 3) return s
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

// "yyyy-MM-dd" → "dd/MM"
function fmtDayMonth(s: string): string {
  const parts = s.split('-')
  if (parts.length !== 3) return s
  const [, m, d] = parts
  return `${d}/${m}`
}

// ===== ISO week helpers (không cần library) — tính khoảng ngày cho label tuần =====
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

function dm(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// "YYYY-Www" → "Tuần dd/MM – dd/MM"
function weekLabelFromISO(week: string): string {
  const parsed = parseWeek(week)
  if (!parsed) return ''
  const monday = mondayOfISOWeek(parsed.year, parsed.week)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return `Tuần ${dm(monday)} – ${dm(sunday)}`
}

// Nhãn số buổi còn lại của gói
function sessionsLabel(pkg: MyPackageResponse): string {
  return pkg.sessionsRemaining != null
    ? `Còn ${pkg.sessionsRemaining} buổi`
    : 'Không giới hạn'
}

export default function PrivateBookingPage() {
  const [packages, setPackages] = useState<MyPackageResponse[]>([])
  const [packagesLoaded, setPackagesLoaded] = useState(false)
  const [slotsData, setSlotsData] = useState<PrivateSlotsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  // HLV đang xem lịch
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null)

  // Modal xác nhận
  const [confirmSlot, setConfirmSlot] = useState<SlotEntry | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [booking, setBooking] = useState(false)
  // Gói 1-2: người đồng hành
  const [companionMode, setCompanionMode] = useState<'MATCHMAKING' | 'INVITE'>('MATCHMAKING')
  const [companionContact, setCompanionContact] = useState('')

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  // ===== Nạp gói của tôi =====
  const loadPackages = useCallback(async () => {
    try {
      const data = await fetchMyPackages()
      setPackages(data)
      setPackagesLoaded(true)
    } catch (err) {
      showToast(parseApiError(err)[0].message, 'error')
      setPackagesLoaded(true)
    }
  }, [showToast])

  // ===== Nạp slot trống =====
  const loadSlots = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPrivateSlots()
      setSlotsData(data)
    } catch (err) {
      showToast(parseApiError(err)[0].message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  // Chỉ nạp slot khi hội viên có gói 1-1/1-2 hợp lệ
  const privatePackages = useMemo(
    () =>
      packages.filter(
        (p) => p.status === 'ACTIVE' && PRIVATE_CATEGORIES.has(p.category)
      ),
    [packages]
  )

  const hasPrivatePackage = privatePackages.length > 0

  useEffect(() => {
    if (packagesLoaded && hasPrivatePackage) {
      void loadSlots()
    }
  }, [packagesLoaded, hasPrivatePackage, loadSlots])

  const slots = slotsData?.slots ?? []

  // ===== Danh sách HLV (unique) từ slots =====
  const trainers = useMemo(() => {
    const map = new Map<number, string>()
    slots.forEach((s) => {
      if (!map.has(s.trainerId)) map.set(s.trainerId, s.trainerName)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [slots])

  // Auto chọn HLV đầu tiên khi có dữ liệu
  useEffect(() => {
    if (trainers.length > 0 && selectedTrainerId === null) {
      setSelectedTrainerId(trainers[0].id)
    }
  }, [trainers, selectedTrainerId])

  // Slots của HLV đang chọn
  const trainerSlots = useMemo(
    () => slots.filter((s) => s.trainerId === selectedTrainerId),
    [slots, selectedTrainerId]
  )

  // Khung giờ (startTime) duy nhất, đã sắp xếp — làm cột
  const allTimes = useMemo(
    () => [...new Set(trainerSlots.map((s) => s.startTime))].sort(),
    [trainerSlots]
  )

  // Ngày (yyyy-MM-dd) theo từng thứ trong tuần — làm hàng
  const dateByDay = useMemo(() => {
    const map = {} as Record<DayOfWeek, string>
    trainerSlots.forEach((s) => {
      if (!map[s.dayOfWeek]) map[s.dayOfWeek] = s.date
    })
    return map
  }, [trainerSlots])

  // Tra cứu nhanh slot theo (dayOfWeek, startTime)
  const slotLookup = useMemo(() => {
    const map = new Map<string, SlotEntry>()
    trainerSlots.forEach((s) => {
      map.set(`${s.dayOfWeek}|${s.startTime}`, s)
    })
    return map
  }, [trainerSlots])

  // ===== Modal =====
  function openConfirm(slot: SlotEntry) {
    setConfirmSlot(slot)
    // 1 gói → tự chọn; nhiều gói → ưu tiên gói còn nhiều buổi nhất
    const sorted = [...privatePackages].sort(
      (a, b) => (b.sessionsRemaining ?? Infinity) - (a.sessionsRemaining ?? Infinity)
    )
    setSelectedPackageId(sorted.length > 0 ? String(sorted[0].id) : '')
    setCompanionMode('MATCHMAKING')
    setCompanionContact('')
  }

  function closeConfirm() {
    setConfirmSlot(null)
    setSelectedPackageId('')
    setCompanionContact('')
  }

  const selectedPackage = privatePackages.find(
    (p) => String(p.id) === selectedPackageId
  )
  const isCombo12 = selectedPackage?.category === 'GOI_1_2'

  async function handleConfirmBooking() {
    if (!confirmSlot || !selectedPackage) return
    setBooking(true)
    try {
      // Gói 1-2: người đồng hành.
      // Lưu ý: khi "Mời hội viên cụ thể", backend chưa resolve email/SĐT → memberId,
      // nên phiên bản này truyền partnerMemberId = null (feature chưa hoàn chỉnh).
      const joinMatchmaking = isCombo12 ? companionMode === 'MATCHMAKING' : undefined
      await createPrivateBooking({
        trainerId: confirmSlot.trainerId,
        date: confirmSlot.date,
        startTime: confirmSlot.startTime,
        memberPackageId: selectedPackage.id,
        partnerMemberId: null,
        joinMatchmaking,
      })
      closeConfirm()
      showToast('Đặt lịch 1-1/1-2 thành công!', 'success')
      // Refresh slot grid + gói (số buổi thay đổi)
      await Promise.all([loadSlots(), loadPackages()])
    } catch (err) {
      const status = (err as AxiosError).response?.status
      const message = parseApiError(err)[0].message
      // 409: khung giờ vừa bị đặt → đóng modal + refresh grid
      if (status === 409) {
        closeConfirm()
        showToast(message, 'error')
        await loadSlots()
      } else {
        // 400 / 422 / khác → toast lỗi
        showToast(message, 'error')
      }
    } finally {
      setBooking(false)
    }
  }

  const weekLabel = slotsData ? weekLabelFromISO(slotsData.targetWeek) : ''

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-800">Đăng ký buổi 1-1/1-2</h1>

      {/* ===== Bước 1: chưa nạp xong gói ===== */}
      {!packagesLoaded && (
        <div className="text-center py-8 text-gray-400 text-sm">Đang tải...</div>
      )}

      {/* ===== E-2: không có gói 1-1/1-2 hợp lệ ===== */}
      {packagesLoaded && !hasPrivatePackage && (
        <div className="bg-white rounded-lg shadow p-6 max-w-xl">
          <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
            Bạn chưa có gói 1-1/1-2 còn hiệu lực. Vui lòng liên hệ lễ tân để đăng ký gói
            phù hợp.
          </div>
        </div>
      )}

      {/* ===== Có gói → hiển thị lịch ===== */}
      {packagesLoaded && hasPrivatePackage && (
        <>
          {/* Banner deadline */}
          {slotsData?.deadlinePassed && (
            <div className="rounded-md bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 text-sm">
              ⚠ Đã hết hạn đăng ký cho tuần kế tiếp. Đang hiển thị lịch cho tuần{' '}
              {weekLabel || slotsData.targetWeek}.
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-4 space-y-4">
            {/* Tuần đang xem */}
            <div className="text-sm font-medium text-gray-700">
              {loading ? 'Đang tải...' : weekLabel}
            </div>

            {/* Chọn HLV */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                Chọn huấn luyện viên
              </div>
              {trainers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Chưa có huấn luyện viên nào có lịch trống trong tuần này.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trainers.map((t) => {
                    const active = t.id === selectedTrainerId
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTrainerId(t.id)}
                        className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                          active
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {t.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Grid slot */}
            {selectedTrainerId !== null && allTimes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600">
                        Ngày
                      </th>
                      {allTimes.map((t) => {
                        const sample = trainerSlots.find((s) => s.startTime === t)
                        return (
                          <th
                            key={t}
                            className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-600 whitespace-nowrap"
                          >
                            {t}
                            {sample ? `–${sample.endTime}` : ''}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {DAY_ORDER.filter((day) => dateByDay[day]).map((day) => (
                      <tr key={day}>
                        <td className="sticky left-0 z-10 bg-white border border-gray-200 px-3 py-2 whitespace-nowrap">
                          <div className="font-semibold text-gray-700">
                            {DAY_LABEL[day]}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {fmtDayMonth(dateByDay[day])}
                          </div>
                        </td>
                        {allTimes.map((t) => {
                          const slot = slotLookup.get(`${day}|${t}`)
                          return (
                            <td
                              key={t}
                              className="border border-gray-200 px-1.5 py-1.5 text-center"
                            >
                              {!slot ? (
                                <span className="text-gray-300">–</span>
                              ) : slot.available ? (
                                <button
                                  onClick={() => openConfirm(slot)}
                                  className="w-full px-2 py-1 rounded bg-teal-600 text-white text-xs font-medium hover:bg-teal-700"
                                >
                                  Trống
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="w-full px-2 py-1 rounded bg-gray-100 text-gray-400 text-xs font-medium cursor-not-allowed"
                                >
                                  Đã đặt
                                </button>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading &&
              selectedTrainerId !== null &&
              allTimes.length === 0 &&
              trainers.length > 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  Huấn luyện viên này chưa có khung giờ nào trong tuần.
                </div>
              )}
          </div>
        </>
      )}

      {/* ===== Modal xác nhận ===== */}
      {confirmSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Xác nhận đặt lịch 1-1/1-2
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Chi tiết buổi */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Huấn luyện viên</span>
                  <span className="font-medium text-gray-800">
                    {confirmSlot.trainerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ngày</span>
                  <span className="text-gray-700">
                    {fmtDate(confirmSlot.date)} — {DAY_LABEL[confirmSlot.dayOfWeek]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Giờ</span>
                  <span className="text-gray-700">
                    {confirmSlot.startTime} – {confirmSlot.endTime}
                  </span>
                </div>
              </div>

              {/* Chọn gói */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gói sử dụng
                </label>
                {privatePackages.length === 1 ? (
                  <div className="text-sm text-gray-800 border border-gray-200 rounded px-3 py-2 bg-gray-50">
                    {privatePackages[0].packageTypeName} (
                    {sessionsLabel(privatePackages[0])})
                  </div>
                ) : (
                  <select
                    value={selectedPackageId}
                    onChange={(e) => setSelectedPackageId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    {privatePackages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.packageTypeName} ({sessionsLabel(p)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Người đồng hành — chỉ gói 1-2 */}
              {isCombo12 && (
                <div className="border-t pt-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Người đồng hành
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="companion"
                        checked={companionMode === 'INVITE'}
                        onChange={() => setCompanionMode('INVITE')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      Mời hội viên cụ thể
                    </label>
                    {companionMode === 'INVITE' && (
                      <div className="ml-6">
                        <input
                          type="text"
                          value={companionContact}
                          onChange={(e) => setCompanionContact(e.target.value)}
                          placeholder="Nhập email hoặc SĐT"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                        {/* NOTE: Backend chưa resolve email/SĐT → memberId.
                            Feature "mời hội viên cụ thể" chưa hoàn chỉnh: hiện gửi
                            partnerMemberId = null, backend sẽ bổ sung tra cứu sau. */}
                        <p className="text-[11px] text-amber-600 mt-1">
                          Tính năng mời trực tiếp đang được hoàn thiện. Hệ thống sẽ ghi
                          nhận yêu cầu ghép đôi.
                        </p>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="companion"
                        checked={companionMode === 'MATCHMAKING'}
                        onChange={() => setCompanionMode('MATCHMAKING')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      Để hệ thống ghép
                    </label>
                  </div>
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
                {booking ? 'Đang đặt...' : 'Xác nhận đặt lịch'}
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
