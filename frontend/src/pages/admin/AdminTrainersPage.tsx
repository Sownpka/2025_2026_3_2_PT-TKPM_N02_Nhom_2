import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { trainersApi } from '../../api/trainers'
import { parseApiError } from '../../api/auth'
import type {
  TrainerResponse,
  AvailableAccountResponse,
  DayOfWeek,
  ShiftSession,
  TrainerShiftsResponse,
} from '../../types/trainer'

type ModalType = 'add' | 'edit' | 'confirm' | 'shifts' | null
type ToastType = 'success' | 'error'

interface FormState {
  userAccountId: string
  specialty: string
  contactPhone: string
}

const EMPTY_FORM: FormState = {
  userAccountId: '',
  specialty: '',
  contactPhone: '',
}

// Thứ tự cột T2 → CN và nhãn hiển thị
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

// ===== ISO week helpers (không cần library) =====

function parseWeek(week: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week)
  if (!m) return null
  return { year: Number(m[1]), week: Number(m[2]) }
}

// Thứ 2 (UTC) của tuần ISO đã cho
function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayNum = jan4.getUTCDay() || 7 // CN=0 → 7
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayNum - 1))
  const target = new Date(mondayWeek1)
  target.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7)
  return target
}

// Date → "YYYY-Www"
function toISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // Thứ 5 của tuần này
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// Dịch tuần đi delta*7 ngày, trả về "YYYY-Www" mới
function shiftWeek(week: string, delta: number): string {
  const parsed = parseWeek(week)
  if (!parsed) return week
  const monday = mondayOfISOWeek(parsed.year, parsed.week)
  monday.setUTCDate(monday.getUTCDate() + delta * 7)
  return toISOWeek(monday)
}

// Nhãn "Tuần dd/mm – dd/mm"
function weekLabel(week: string): string {
  const parsed = parseWeek(week)
  if (!parsed) return ''
  const monday = mondayOfISOWeek(parsed.year, parsed.week)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return `Tuần ${fmt(monday)} – ${fmt(sunday)}`
}

// Số phút → "X giờ Y phút"
function formatMinutes(m: number): string {
  const total = m > 0 ? m : 0
  return `${Math.floor(total / 60)} giờ ${total % 60} phút`
}

export default function AdminTrainersPage() {
  const [items, setItems] = useState<TrainerResponse[]>([])
  const [loading, setLoading] = useState(false)

  const [modal, setModal] = useState<ModalType>(null)
  const [selected, setSelected] = useState<TrainerResponse | null>(null)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Modal thêm: danh sách tài khoản TRAINER chưa có hồ sơ
  const [availableAccounts, setAvailableAccounts] = useState<AvailableAccountResponse[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)

  // Modal lưới ca làm việc
  const [shifts, setShifts] = useState<TrainerShiftsResponse | null>(null)
  const [shiftsLoading, setShiftsLoading] = useState(false)

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await trainersApi.getAll()
      setItems(data)
    } catch (err) {
      setItems([])
      setToast({ message: parseApiError(err)[0].message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  // Tự động ẩn toast sau 3s
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function openAddModal() {
    setSelected(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setModal('add')
    setAccountsLoading(true)
    try {
      const { data } = await trainersApi.getAvailableAccounts()
      setAvailableAccounts(data)
    } catch (err) {
      setAvailableAccounts([])
      showToast(parseApiError(err)[0].message, 'error')
    } finally {
      setAccountsLoading(false)
    }
  }

  function openEditModal(item: TrainerResponse) {
    setSelected(item)
    setForm({
      userAccountId: String(item.userAccountId),
      specialty: item.specialty ?? '',
      contactPhone: item.contactPhone ?? '',
    })
    setFieldErrors({})
    setModal('edit')
  }

  function openConfirmModal(item: TrainerResponse) {
    setSelected(item)
    setModal('confirm')
  }

  const loadShifts = useCallback(
    async (trainerId: number, week?: string) => {
      setShiftsLoading(true)
      try {
        const { data } = await trainersApi.getShifts(trainerId, week)
        setShifts(data)
      } catch (err) {
        setShifts(null)
        showToast(parseApiError(err)[0].message, 'error')
      } finally {
        setShiftsLoading(false)
      }
    },
    [showToast]
  )

  function openShiftsModal(item: TrainerResponse) {
    setSelected(item)
    setShifts(null)
    setModal('shifts')
    // Lần đầu: không truyền week → backend trả tuần hiện tại đã chuẩn hoá
    void loadShifts(item.id)
  }

  function changeWeek(delta: number) {
    if (!selected || !shifts) return
    void loadShifts(selected.id, shiftWeek(shifts.week, delta))
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setAvailableAccounts([])
    setShifts(null)
  }

  // Chuẩn hoá cả 2 dạng lỗi backend: object đơn {field?, message} và mảng [{field, message}]
  function applyErrors(err: unknown) {
    const errors = parseApiError(err)
    const fieldMap: Record<string, string> = {}
    let general = ''
    for (const e of errors) {
      if (e.field) fieldMap[e.field] = e.message
      else general = e.message
    }
    setFieldErrors(fieldMap)
    if (general || Object.keys(fieldMap).length === 0) {
      showToast(general || 'Đã có lỗi xảy ra. Vui lòng thử lại.', 'error')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setSaving(true)
    try {
      if (modal === 'edit' && selected) {
        await trainersApi.update(selected.id, {
          specialty: form.specialty.trim(),
          contactPhone: form.contactPhone.trim(),
        })
        showToast('Cập nhật thành công!', 'success')
      } else {
        await trainersApi.create({
          userAccountId: Number(form.userAccountId),
          specialty: form.specialty.trim(),
          contactPhone: form.contactPhone.trim(),
        })
        showToast('Thêm hồ sơ huấn luyện viên thành công!', 'success')
      }
      closeModal()
      await loadItems()
    } catch (err) {
      applyErrors(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDeactivate() {
    if (!selected) return
    try {
      await trainersApi.deactivate(selected.id)
      showToast('Đã ngừng hoạt động huấn luyện viên.', 'success')
      closeModal()
      await loadItems()
    } catch (err) {
      closeModal()
      showToast(parseApiError(err)[0].message, 'error')
    }
  }

  const isEdit = modal === 'edit'
  const noAvailable = !accountsLoading && availableAccounts.length === 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">Quản lý Huấn luyện viên</h1>
        <button
          onClick={() => void openAddModal()}
          className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 text-sm font-medium"
        >
          + Thêm HLV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Họ tên
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Chuyên môn
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                SĐT liên hệ
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tổng giờ dạy tuần này
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Trạng thái
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.fullName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.email}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.specialty || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.contactPhone || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatMinutes(item.totalMinutesThisWeek)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {item.status === 'ACTIVE' ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Hoạt động
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      Ngừng hoạt động
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => openShiftsModal(item)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Xem lịch
                  </button>
                  <button
                    onClick={() => openEditModal(item)}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => openConfirmModal(item)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">Chưa có huấn luyện viên nào</div>
        )}
        {loading && <div className="text-center py-8 text-gray-400">Đang tải...</div>}
      </div>

      {/* Modal Thêm HLV */}
      {modal === 'add' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Thêm huấn luyện viên</h2>
            </div>

            {accountsLoading ? (
              <div className="px-6 py-8 text-center text-gray-400">Đang tải tài khoản...</div>
            ) : noAvailable ? (
              <div className="px-6 py-6">
                <p className="text-sm text-gray-600">
                  Không còn tài khoản huấn luyện viên chưa được tạo hồ sơ. Vui lòng thêm tài khoản
                  mới ở mục Tài khoản trước.
                </p>
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                <Field label="Chọn tài khoản HLV" required error={fieldErrors.userAccountId}>
                  <select
                    value={form.userAccountId}
                    onChange={(e) => updateField('userAccountId', e.target.value)}
                    className={inputClass(fieldErrors.userAccountId)}
                  >
                    <option value="">-- Chọn tài khoản --</option>
                    {availableAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.fullName} ({acc.email})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Chuyên môn" error={fieldErrors.specialty}>
                  <input
                    type="text"
                    value={form.specialty}
                    onChange={(e) => updateField('specialty', e.target.value)}
                    placeholder="VD: Pilates cơ bản, Reformer"
                    className={inputClass(fieldErrors.specialty)}
                  />
                </Field>

                <Field label="SĐT liên hệ" error={fieldErrors.contactPhone}>
                  <input
                    type="text"
                    value={form.contactPhone}
                    onChange={(e) => updateField('contactPhone', e.target.value)}
                    className={inputClass(fieldErrors.contactPhone)}
                  />
                </Field>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Sửa HLV */}
      {isEdit && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Chỉnh sửa huấn luyện viên</h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <Field label="Họ tên">
                <input
                  type="text"
                  value={selected.fullName}
                  readOnly
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </Field>

              <Field label="Chuyên môn" error={fieldErrors.specialty}>
                <input
                  type="text"
                  value={form.specialty}
                  onChange={(e) => updateField('specialty', e.target.value)}
                  placeholder="VD: Pilates cơ bản, Reformer"
                  className={inputClass(fieldErrors.specialty)}
                />
              </Field>

              <Field label="SĐT liên hệ" error={fieldErrors.contactPhone}>
                <input
                  type="text"
                  value={form.contactPhone}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                  className={inputClass(fieldErrors.contactPhone)}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
                >
                  {saving ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lưới ca làm việc (S-1) */}
      {modal === 'shifts' && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                Lịch dạy — {selected.fullName}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4">
              {/* Thanh điều hướng tuần */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={() => changeWeek(-1)}
                  disabled={!shifts || shiftsLoading}
                  className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  aria-label="Tuần trước"
                >
                  ←
                </button>
                <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
                  {shifts ? weekLabel(shifts.week) : 'Đang tải...'}
                </span>
                <button
                  onClick={() => changeWeek(1)}
                  disabled={!shifts || shiftsLoading}
                  className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  aria-label="Tuần sau"
                >
                  →
                </button>
              </div>

              {/* Lưới 7 cột T2 → CN */}
              <div className="grid grid-cols-7 gap-2">
                {DAY_ORDER.map((day) => {
                  const daySessions = shifts
                    ? shifts.sessions.filter((s) => s.dayOfWeek === day)
                    : []
                  return (
                    <div key={day} className="min-h-[120px]">
                      <div className="text-center text-xs font-semibold text-gray-600 pb-2 border-b border-gray-200 mb-2">
                        {DAY_LABEL[day]}
                      </div>
                      <div className="space-y-2">
                        {daySessions.map((s) => (
                          <ShiftCard key={s.sessionId} session={s} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {shiftsLoading && (
                <div className="text-center py-4 text-gray-400 text-sm">Đang tải lịch...</div>
              )}
              {!shiftsLoading && shifts && shifts.sessions.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  Chưa có lịch dạy trong tuần này.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog Ngừng hoạt động */}
      {modal === 'confirm' && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <p className="text-gray-800">
                Bạn có chắc muốn ngừng hoạt động huấn luyện viên này?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {selected.fullName} — {selected.email}
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDeactivate}
                className="px-4 py-2 rounded bg-red-500 text-white text-sm font-medium hover:bg-red-600"
              >
                Xác nhận
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

function ShiftCard({ session }: { session: ShiftSession }) {
  return (
    <div className="bg-teal-50 border border-teal-200 rounded p-2 text-xs">
      <div className="font-medium text-teal-800 break-words">{session.className}</div>
      <div className="text-teal-600 mt-0.5">
        {session.startTime}–{session.endTime}
      </div>
    </div>
  )
}

function inputClass(error?: string): string {
  return `w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    error
      ? 'border-red-400 focus:ring-red-400'
      : 'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
  }`
}

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}

function Field({ label, required, error, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
