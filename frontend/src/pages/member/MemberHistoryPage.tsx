import { useCallback, useEffect, useState } from 'react'
import {
  fetchMyPackages,
  fetchMyHistory,
  type MyPackageResponse,
  type MyPackageStatus,
  type MyHistoryItem,
  type HistoryFilter,
  type AttendanceStatus,
} from '../../api/me'
import { parseApiError } from '../../api/auth'
import type { PackageCategory } from '../../types'

// Danh mục gói tính theo số buổi
const SESSION_CATEGORIES = new Set<PackageCategory>(['THEO_BUOI', 'GOI_1_1', 'GOI_1_2'])

const PACKAGE_STATUS_PILL: Record<
  MyPackageStatus,
  { className: string; label: string }
> = {
  ACTIVE: { className: 'bg-green-100 text-green-800', label: 'Đang hoạt động' },
  EXPIRED: { className: 'bg-gray-100 text-gray-600', label: 'Đã hết hạn' },
  USED_UP: { className: 'bg-gray-100 text-gray-600', label: 'Hết buổi' },
}

const ATTENDANCE_PILL: Record<
  AttendanceStatus,
  { className: string; label: string }
> = {
  ATTENDED: { className: 'bg-green-100 text-green-800', label: 'Đã tập' },
  NO_SHOW: { className: 'bg-red-100 text-red-700', label: 'No-show' },
}

const FILTER_OPTIONS: { value: HistoryFilter; label: string }[] = [
  { value: 'WEEK', label: 'Tuần này' },
  { value: 'MONTH', label: 'Tháng này' },
  { value: 'CUSTOM', label: 'Tùy chọn' },
]

// "yyyy-MM-dd" -> "dd/MM/yyyy"
function formatDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

// "HH:mm:ss" -> "HH:mm"
function formatTime(time: string): string {
  return time.slice(0, 5)
}

function sessionLabel(pkg: MyPackageResponse): string {
  if (SESSION_CATEGORIES.has(pkg.category) && pkg.sessionsRemaining != null) {
    return `Còn lại: ${pkg.sessionsRemaining} buổi`
  }
  return 'Không giới hạn'
}

interface HistoryQuery {
  filter: HistoryFilter
  from?: string
  to?: string
}

export default function MemberHistoryPage() {
  // --- Khối 1: Gói tập ---
  const [packages, setPackages] = useState<MyPackageResponse[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packagesError, setPackagesError] = useState('')

  // --- Khối 2: Lịch sử ---
  const [history, setHistory] = useState<MyHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  // Giá trị select đang hiển thị (điều khiển UI)
  const [filter, setFilter] = useState<HistoryFilter>('MONTH')
  // Input ngày cho chế độ CUSTOM
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [rangeError, setRangeError] = useState('')
  // Truy vấn thực tế đang được áp dụng cho bảng (mặc định MONTH)
  const [query, setQuery] = useState<HistoryQuery>({ filter: 'MONTH' })

  const loadPackages = useCallback(async () => {
    setPackagesLoading(true)
    setPackagesError('')
    try {
      const data = await fetchMyPackages()
      setPackages(data)
    } catch (err) {
      setPackages([])
      setPackagesError(parseApiError(err)[0].message)
    } finally {
      setPackagesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  // Tải lịch sử mỗi khi query thay đổi (WEEK/MONTH đổi ngay; CUSTOM khi bấm "Lọc")
  useEffect(() => {
    let active = true
    async function load() {
      setHistoryLoading(true)
      setHistoryError('')
      try {
        const data = await fetchMyHistory(query.filter, query.from, query.to)
        if (active) setHistory(data)
      } catch (err) {
        if (active) {
          setHistory([])
          setHistoryError(parseApiError(err)[0].message)
        }
      } finally {
        if (active) setHistoryLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [query])

  function handleFilterChange(value: HistoryFilter) {
    setFilter(value)
    setRangeError('')
    // WEEK/MONTH áp dụng ngay; CUSTOM chờ người dùng bấm "Lọc"
    if (value !== 'CUSTOM') {
      setQuery({ filter: value })
    }
  }

  function handleApplyCustom() {
    if (!customFrom || !customTo) {
      setRangeError('Vui lòng chọn cả ngày bắt đầu và ngày kết thúc.')
      return
    }
    if (customFrom > customTo) {
      setRangeError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.')
      return
    }
    setRangeError('')
    setQuery({ filter: 'CUSTOM', from: customFrom, to: customTo })
  }

  return (
    <div className="space-y-8">
      {/* ===== Khối 1: Gói tập của tôi ===== */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Gói tập của tôi</h2>

        {packagesError && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {packagesError}
          </div>
        )}

        {packagesLoading ? (
          <div className="text-center py-8 text-gray-400">Đang tải...</div>
        ) : packages.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 font-medium">Chưa đăng ký gói tập nào</p>
            <p className="text-sm text-gray-400 mt-1">
              Vui lòng liên hệ lễ tân để đăng ký gói tập.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => {
              const pill = PACKAGE_STATUS_PILL[pkg.status]
              return (
                <div key={pkg.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-800">
                      {pkg.packageTypeName}
                    </h3>
                    {pkg.nearExpiry && (
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 whitespace-nowrap">
                        ⚠ Sắp hết
                      </span>
                    )}
                  </div>

                  <div>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${pill.className}`}
                    >
                      {pill.label}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700">{sessionLabel(pkg)}</p>

                  <div className="text-sm text-gray-500 space-y-0.5 pt-1 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span>Ngày bắt đầu</span>
                      <span className="text-gray-700">{formatDate(pkg.startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ngày hết hạn</span>
                      <span className="text-gray-700">{formatDate(pkg.endDate)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ===== Khối 2: Lịch sử tập luyện ===== */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Lịch sử tập luyện</h2>

        {/* Filter bar */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Khoảng thời gian
            </label>
            <select
              value={filter}
              onChange={(e) => handleFilterChange(e.target.value as HistoryFilter)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {filter === 'CUSTOM' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <button
                onClick={handleApplyCustom}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Lọc
              </button>
            </>
          )}

          {rangeError && (
            <p className="w-full text-xs text-red-500">{rangeError}</p>
          )}
        </div>

        {historyError && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {historyError}
          </div>
        )}

        {/* Bảng lịch sử */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ngày
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Lớp học
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Huấn luyện viên
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Giờ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.map((item, idx) => {
                const pill = ATTENDANCE_PILL[item.attendanceStatus]
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {formatDate(item.sessionDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{item.className}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.trainerName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatTime(item.startTime)} – {formatTime(item.endTime)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${pill.className}`}
                      >
                        {pill.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {historyLoading && (
            <div className="text-center py-8 text-gray-400">Đang tải...</div>
          )}
          {!historyLoading && history.length === 0 && !historyError && (
            <div className="text-center py-8 text-gray-500">
              Chưa có buổi tập nào được ghi nhận
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
