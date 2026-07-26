import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMemberPackageStore } from '../../stores/memberPackageStore'
import { parseApiError } from '../../api/auth'
import Toast from '../../components/Toast'
import type { MemberResponse, PackageCategory } from '../../types'
import type { MemberPackageResponse } from '../../types/memberPackage'

const CATEGORY_LABEL: Record<PackageCategory, string> = {
  THEO_BUOI: 'Theo buổi',
  THEO_THANG: 'Theo tháng',
  KHONG_GIOI_HAN: 'Không giới hạn',
  GOI_1_1: 'Gói 1-1',
  GOI_1_2: 'Gói 1-2',
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'
}

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function formatDateVn(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN')
}

// Chuyển ISO (yyyy-mm-dd) → hiển thị dd/mm/yyyy
function isoToVnDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return iso
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Chuyển dd/mm/yyyy → ISO (yyyy-mm-dd); trả null nếu chưa nhập đủ
function vnDisplayToIso(vn: string): string | null {
  const m = vn.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

export default function RegisterPackagePage() {
  const navigate = useNavigate()
  const {
    searchResults,
    searching,
    searched,
    selectedMember,
    memberPackages,
    loadingPackages,
    packageTypes,
    searchMembers,
    selectMember,
    loadPackageTypes,
    register,
    reset,
  } = useMemberPackageStore()

  const [query, setQuery] = useState('')
  const [packageTypeId, setPackageTypeId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState(todayIso())         // lưu ISO yyyy-mm-dd
  const [startDateDisplay, setStartDateDisplay] = useState(isoToVnDisplay(todayIso())) // hiển thị dd/mm/yyyy
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [privateNotice, setPrivateNotice] = useState('')

  // Nạp danh sách loại gói ACTIVE khi mở trang; dọn state khi rời trang
  useEffect(() => {
    void loadPackageTypes()
    return () => reset()
  }, [loadPackageTypes, reset])

  // Gói ACTIVE hiện tại của hội viên (nếu có) — dùng để cảnh báo gia hạn
  const activePackage = useMemo<MemberPackageResponse | null>(
    () => memberPackages.find((p) => p.status === 'ACTIVE') ?? null,
    [memberPackages]
  )

  const selectedType = useMemo(
    () => packageTypes.find((p) => p.id === packageTypeId) ?? null,
    [packageTypes, packageTypeId]
  )

  const isRenewal = !!activePackage

  function setStartDateBoth(iso: string) {
    setStartDate(iso)
    setStartDateDisplay(isoToVnDisplay(iso))
  }

  // Khi activePackage thay đổi (chọn hội viên mới xong load xong), gợi ý ngày bắt đầu
  useEffect(() => {
    if (loadingPackages) return
    if (activePackage) {
      setStartDateBoth(addDays(activePackage.endDate, 1))
    } else if (selectedMember) {
      setStartDateBoth(todayIso())
    }
  }, [activePackage, loadingPackages, selectedMember])

  const previewEnd =
    selectedType != null && startDate
      ? addDays(startDate, selectedType.durationDays)
      : ''

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')
    try {
      await searchMembers(query)
    } catch (err) {
      setFieldErrors({ memberId: parseApiError(err)[0].message })
    }
  }

  function handlePickMember(member: MemberResponse) {
    setFieldErrors({})
    setFormError('')
    setPackageTypeId('')
    setStartDateBoth(todayIso())
    setPrivateNotice('')
    void selectMember(member)
  }

  function handleCreateMember() {
    // S-1: điều hướng tới trang quản lý hội viên (UC2.1) để tạo hội viên mới
    navigate('/reception/members')
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')
    setPrivateNotice('')

    if (!selectedMember) {
      setFieldErrors({ memberId: 'Vui lòng chọn hội viên' })
      return
    }
    if (packageTypeId === '') {
      setFieldErrors({ packageTypeId: 'Vui lòng chọn loại gói tập' })
      return
    }

    setSubmitting(true)
    try {
      const result = await register({
        memberId: selectedMember.id,
        packageTypeId: packageTypeId,
        startDate: startDate,
      })
      setToast('Đăng ký gói tập thành công!')
      if (result.isPrivatePackage) {
        setPrivateNotice(
          'Hội viên cần tự đăng ký lịch tập hằng tuần qua chức năng Đặt buổi 1-1/1-2 trước hạn chót.'
        )
      }
      // Reset form đăng ký (giữ hội viên đang chọn; card đã tự cập nhật gói mới)
      setPackageTypeId('')
    } catch (err) {
      const errors = parseApiError(err)
      const map: Record<string, string> = {}
      let general = ''
      for (const er of errors) {
        if (er.field) map[er.field] = er.message
        else general = er.message
      }
      setFieldErrors(map)
      if (general || Object.keys(map).length === 0) {
        setFormError(general || 'Đã có lỗi xảy ra. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const noResults = searched && !searching && searchResults.length === 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── Section 1: Tìm hội viên ─────────────────────────────── */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          1. Tìm hội viên
        </h2>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập tên hoặc số điện thoại..."
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-[#0D9488] text-white px-5 py-2 rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
          >
            {searching ? 'Đang tìm...' : 'Tìm'}
          </button>
        </form>

        {fieldErrors.memberId && (
          <p className="text-xs text-red-500 mt-2">{fieldErrors.memberId}</p>
        )}

        {/* Kết quả tìm kiếm dạng danh sách clickable */}
        {searchResults.length > 0 && (
          <ul className="mt-4 border border-gray-200 rounded divide-y divide-gray-100 overflow-hidden">
            {searchResults.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => handlePickMember(m)}
                  className="w-full text-left px-4 py-3 hover:bg-teal-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-800">
                    {m.fullName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {m.phone} · {m.email}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* S-1: Không tìm thấy hội viên */}
        {noResults && !selectedMember && (
          <div className="mt-4 text-center py-6 bg-gray-50 rounded">
            <p className="text-sm text-gray-500 mb-3">Không tìm thấy hội viên</p>
            <button
              type="button"
              onClick={handleCreateMember}
              className="bg-[#0D9488] text-white px-4 py-2 rounded text-sm font-medium hover:bg-teal-700"
            >
              Tạo hội viên mới
            </button>
          </div>
        )}

        {/* Card hội viên đã chọn */}
        {selectedMember && (
          <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-gray-800">
                  {selectedMember.fullName}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  SĐT: {selectedMember.phone}
                </div>
                <div className="text-xs text-gray-600">
                  Email: {selectedMember.email}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {activePackage?.warningSessions && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    ⚠ Sắp hết buổi
                  </span>
                )}
                {activePackage?.warningExpiry && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    ⚠ Sắp hết hạn
                  </span>
                )}
              </div>
            </div>

            {/* Gói hiện tại */}
            <div className="mt-3 pt-3 border-t border-teal-200 text-xs text-gray-700">
              {loadingPackages ? (
                <span className="text-gray-400">Đang tải gói tập...</span>
              ) : activePackage ? (
                <div>
                  <span className="font-medium">Gói hiện tại:</span>{' '}
                  {activePackage.packageTypeName} ·{' '}
                  {activePackage.sessionsRemaining == null
                    ? 'Không giới hạn'
                    : `Còn ${activePackage.sessionsRemaining} buổi`}{' '}
                  · Hết hạn {formatDateVn(activePackage.endDate)}
                </div>
              ) : (
                <span className="text-gray-500">
                  Hội viên chưa có gói còn hiệu lực
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Section 2: Form đăng ký gói (chỉ hiện sau khi chọn hội viên) ── */}
      {selectedMember && (
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            2. Đăng ký gói tập
          </h2>

          {/* Cảnh báo gia hạn (S-2) */}
          {isRenewal && (
            <div className="mb-4 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded p-3 text-sm">
              Hội viên đang có gói còn hiệu lực. Bạn có chắc muốn đăng ký thêm
              không?
            </div>
          )}

          {/* Lỗi chung */}
          {formError && (
            <div className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm">
              {formError}
            </div>
          )}

          {/* Thông báo gói 1-1/1-2 (S-3) sau khi đăng ký thành công */}
          {privateNotice && (
            <div className="mb-4 bg-teal-50 border border-teal-300 text-teal-800 rounded p-3 text-sm">
              {privateNotice}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Dropdown loại gói */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loại gói tập <span className="text-red-500">*</span>
              </label>
              <select
                value={packageTypeId}
                onChange={(e) =>
                  setPackageTypeId(
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  fieldErrors.packageTypeId
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
                }`}
              >
                <option value="">-- Chọn loại gói --</option>
                {packageTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name} ({CATEGORY_LABEL[pt.category]})
                  </option>
                ))}
              </select>
              {fieldErrors.packageTypeId && (
                <p className="text-xs text-red-500 mt-1">
                  {fieldErrors.packageTypeId}
                </p>
              )}
            </div>

            {/* Ngày bắt đầu — luôn cho nhập, gợi ý sẵn ngày hợp lý */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày bắt đầu <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/yyyy"
                maxLength={10}
                value={startDateDisplay}
                onChange={(e) => {
                  const raw = e.target.value
                  setStartDateDisplay(raw)
                  const iso = vnDisplayToIso(raw)
                  if (iso) setStartDate(iso)
                }}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                {isRenewal
                  ? `Gợi ý: ${formatDateVn(startDate)} (ngay sau khi gói hiện tại hết hạn)`
                  : 'Ngày hết hạn sẽ được tự động tính từ ngày này'}
              </p>
            </div>

            {/* Thông tin tự điền (read-only) */}
            {selectedType && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded p-4 text-sm">
                <ReadOnlyField
                  label="Số buổi"
                  value={
                    selectedType.sessions == null
                      ? 'Không giới hạn'
                      : `${selectedType.sessions} buổi`
                  }
                />
                <ReadOnlyField
                  label="Giá"
                  value={formatVnd(selectedType.price)}
                />
                <ReadOnlyField
                  label="Ngày hết hạn (tự động tính)"
                  value={previewEnd ? formatDateVn(previewEnd) : '—'}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#0D9488] text-white py-2.5 rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
            >
              {submitting ? 'Đang xử lý...' : 'Xác nhận đăng ký'}
            </button>
          </form>
        </section>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-gray-800 font-medium">{value}</div>
    </div>
  )
}
