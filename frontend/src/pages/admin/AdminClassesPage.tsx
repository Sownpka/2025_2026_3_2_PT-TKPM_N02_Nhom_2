import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { classesApi } from '../../api/classes'
import { trainersApi } from '../../api/trainers'
import { equipmentApi } from '../../api/equipment'
import { parseApiError } from '../../api/auth'
import type { DayOfWeek } from '../../types/trainer'
import type {
  GymClassResponse,
  TimetableResponse,
  TimetableSession,
  AvailableTrainerResponse,
} from '../../types/class'

type TabType = 'list' | 'timetable'
type ModalType = 'add' | 'edit' | 'confirm' | null
type ToastType = 'success' | 'error'

// ===== Ngày trong tuần: thứ tự cột T2 → CN =====
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

interface FormState {
  name: string
  equipmentType: string
  days: DayOfWeek[]
  startTime: string
  endTime: string
  trainerId: string
  capacity: string
  description: string
}

const EMPTY_FORM: FormState = {
  name: '',
  equipmentType: '',
  days: [],
  startTime: '',
  endTime: '',
  trainerId: '',
  capacity: '',
  description: '',
}

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

export default function AdminClassesPage() {
  const [tab, setTab] = useState<TabType>('list')

  // Tab 1 — danh sách
  const [items, setItems] = useState<GymClassResponse[]>([])
  const [loading, setLoading] = useState(false)

  // Tab 2 — thời khóa biểu
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null)
  const [timetableLoading, setTimetableLoading] = useState(false)
  const [timetableLoaded, setTimetableLoaded] = useState(false)

  // Modal
  const [modal, setModal] = useState<ModalType>(null)
  const [selected, setSelected] = useState<GymClassResponse | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Gợi ý sức chứa theo loại thiết bị
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({})

  // HLV khả dụng theo ngày + giờ
  const [availableTrainers, setAvailableTrainers] = useState<AvailableTrainerResponse[]>([])
  const [trainersLoading, setTrainersLoading] = useState(false)

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await classesApi.getAll()
      setItems(data)
    } catch (err) {
      setItems([])
      showToast(parseApiError(err)[0].message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const loadTimetable = useCallback(
    async (week?: string) => {
      setTimetableLoading(true)
      try {
        const { data } = await classesApi.getTimetable(week)
        setTimetable(data)
        setTimetableLoaded(true)
      } catch (err) {
        setTimetable(null)
        showToast(parseApiError(err)[0].message, 'error')
      } finally {
        setTimetableLoading(false)
      }
    },
    [showToast]
  )

  function switchTab(next: TabType) {
    setTab(next)
    if (next === 'timetable' && !timetableLoaded) {
      void loadTimetable()
    }
  }

  function changeWeek(delta: number) {
    if (!timetable) return
    void loadTimetable(shiftWeek(timetable.week, delta))
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleDay(day: DayOfWeek) {
    setForm((prev) => {
      const has = prev.days.includes(day)
      const days = has ? prev.days.filter((d) => d !== day) : [...prev.days, day]
      // Giữ thứ tự MON..SUN cho ổn định
      days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
      return { ...prev, days }
    })
  }

  // Nạp gợi ý số máy theo loại (1 lần khi mở modal)
  const loadTypeCounts = useCallback(async () => {
    try {
      const { data } = await equipmentApi.countByType()
      const map: Record<string, number> = {}
      for (const row of data) map[row.type.trim().toLowerCase()] = row.count
      setTypeCounts(map)
    } catch {
      setTypeCounts({})
    }
  }, [])

  function openAddModal() {
    setSelected(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setAvailableTrainers([])
    setModal('add')
    void loadTypeCounts()
  }

  function openEditModal(item: GymClassResponse) {
    setSelected(item)
    setForm({
      name: item.name,
      equipmentType: item.equipmentType ?? '',
      days: [...item.daysOfWeek].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)),
      startTime: hhmm(item.startTime),
      endTime: hhmm(item.endTime),
      trainerId: String(item.trainerId),
      capacity: String(item.capacity),
      description: item.description ?? '',
    })
    setFieldErrors({})
    setAvailableTrainers([])
    setModal('edit')
    void loadTypeCounts()
  }

  function openConfirmModal(item: GymClassResponse) {
    setSelected(item)
    setModal('confirm')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setAvailableTrainers([])
    setTypeCounts({})
  }

  // Điều kiện enable dropdown HLV: có ≥1 ngày + giờ bắt đầu + giờ kết thúc
  const trainerSelectable =
    form.days.length > 0 && form.startTime.trim() !== '' && form.endTime.trim() !== ''

  const isFormModal = modal === 'add' || modal === 'edit'

  // Gọi /available-for-class mỗi khi ngày/giờ thay đổi (khi đủ điều kiện)
  useEffect(() => {
    if (!isFormModal) return
    if (!trainerSelectable) {
      setAvailableTrainers([])
      return
    }
    let cancelled = false
    setTrainersLoading(true)
    trainersApi
      .getAvailableForClass(form.days, form.startTime, form.endTime)
      .then(({ data }) => {
        if (!cancelled) setAvailableTrainers(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setAvailableTrainers([])
          showToast(parseApiError(err)[0].message, 'error')
        }
      })
      .finally(() => {
        if (!cancelled) setTrainersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isFormModal, trainerSelectable, form.days, form.startTime, form.endTime, showToast])

  // Gợi ý số máy theo loại thiết bị đang nhập
  const equipmentHint = useMemo(() => {
    const key = form.equipmentType.trim().toLowerCase()
    if (!key) return null
    const n = typeCounts[key] ?? 0
    return `Hiện có ${n} máy loại này`
  }, [form.equipmentType, typeCounts])

  // Danh sách option HLV: đảm bảo HLV đang chọn (edit) vẫn xuất hiện dù không có trong list khả dụng
  const trainerOptions = useMemo(() => {
    const opts = [...availableTrainers]
    if (
      selected &&
      form.trainerId === String(selected.trainerId) &&
      !opts.some((t) => String(t.id) === form.trainerId)
    ) {
      opts.unshift({ id: selected.trainerId ?? 0, fullName: selected.trainerName ?? '' })
    }
    return opts
  }, [availableTrainers, selected, form.trainerId])

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
    const payload = {
      name: form.name.trim(),
      equipmentType: form.equipmentType.trim(),
      trainerId: Number(form.trainerId),
      daysOfWeek: form.days,
      startTime: form.startTime,
      endTime: form.endTime,
      capacity: Number(form.capacity),
      description: form.description.trim(),
    }
    try {
      if (modal === 'edit' && selected) {
        await classesApi.update(selected.id, payload)
        showToast('Cập nhật lớp học thành công!', 'success')
      } else {
        await classesApi.create(payload)
        showToast('Thêm lớp học thành công!', 'success')
      }
      closeModal()
      await loadItems()
      if (timetableLoaded) await loadTimetable(timetable?.week)
    } catch (err) {
      applyErrors(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDeactivate() {
    if (!selected) return
    try {
      await classesApi.deactivate(selected.id)
      showToast('Đã ngừng hoạt động lớp học.', 'success')
      closeModal()
      await loadItems()
      if (timetableLoaded) await loadTimetable(timetable?.week)
    } catch (err) {
      closeModal()
      showToast(parseApiError(err)[0].message, 'error')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">Quản lý Lớp học</h1>
        {tab === 'list' && (
          <button
            onClick={openAddModal}
            className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 text-sm font-medium"
          >
            + Thêm lớp mới
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <TabButton active={tab === 'list'} onClick={() => switchTab('list')}>
          Danh sách
        </TabButton>
        <TabButton active={tab === 'timetable'} onClick={() => switchTab('timetable')}>
          Thời khóa biểu
        </TabButton>
      </div>

      {tab === 'list' ? (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Tên lớp', 'Loại thiết bị', 'Huấn luyện viên', 'Lịch học', 'Giờ', 'Sức chứa', 'Trạng thái'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.equipmentType || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.trainerName}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {DAY_ORDER.filter((d) => item.daysOfWeek.includes(d)).map((d) => (
                        <span
                          key={d}
                          className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                        >
                          {DAY_LABEL[d]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {hhmm(item.startTime)} – {hhmm(item.endTime)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.capacity}</td>
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
            <div className="text-center py-8 text-gray-500">Chưa có lớp học nào</div>
          )}
          {loading && <div className="text-center py-8 text-gray-400">Đang tải...</div>}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          {/* Thanh điều hướng tuần */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => changeWeek(-1)}
              disabled={!timetable || timetableLoading}
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
              disabled={!timetable || timetableLoading}
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              aria-label="Tuần sau"
            >
              →
            </button>
          </div>

          {/* Lưới 7 cột T2 → CN */}
          <div className="grid grid-cols-7 gap-2">
            {DAY_ORDER.map((day) => {
              const daySessions = timetable
                ? timetable.sessions.filter((s) => s.dayOfWeek === day)
                : []
              return (
                <div key={day} className="min-h-[120px]">
                  <div className="text-center text-xs font-semibold text-gray-600 pb-2 border-b border-gray-200 mb-2">
                    {DAY_LABEL[day]}
                  </div>
                  <div className="space-y-2">
                    {daySessions.map((s) => (
                      <ClassCard key={s.sessionId} session={s} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {timetableLoading && (
            <div className="text-center py-4 text-gray-400 text-sm">Đang tải lịch...</div>
          )}
          {!timetableLoading && timetable && timetable.sessions.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              Chưa có lớp nào trong tuần này.
            </div>
          )}
        </div>
      )}

      {/* Modal thêm/sửa lớp */}
      {isFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {modal === 'edit' ? 'Chỉnh sửa lớp học' : 'Thêm lớp học mới'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <Field label="Tên lớp" required error={fieldErrors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="VD: Lớp Reformer sáng"
                  className={inputClass(fieldErrors.name)}
                />
              </Field>

              <Field label="Loại thiết bị" error={fieldErrors.equipmentType}>
                <input
                  type="text"
                  value={form.equipmentType}
                  onChange={(e) => updateField('equipmentType', e.target.value)}
                  placeholder="VD: Reformer"
                  className={inputClass(fieldErrors.equipmentType)}
                />
                {equipmentHint && (
                  <p className="text-xs text-gray-500 mt-1">{equipmentHint}</p>
                )}
              </Field>

              <Field label="Ngày trong tuần" required error={fieldErrors.daysOfWeek}>
                <div className="flex flex-wrap gap-2">
                  {DAY_ORDER.map((d) => {
                    const active = form.days.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={`px-3 py-1 rounded text-sm font-medium border ${
                          active
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {DAY_LABEL[d]}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Giờ bắt đầu" required error={fieldErrors.startTime}>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => updateField('startTime', e.target.value)}
                    className={inputClass(fieldErrors.startTime)}
                  />
                </Field>
                <Field label="Giờ kết thúc" required error={fieldErrors.endTime}>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => updateField('endTime', e.target.value)}
                    className={inputClass(fieldErrors.endTime)}
                  />
                </Field>
              </div>

              <Field label="Huấn luyện viên" required error={fieldErrors.trainerId}>
                <select
                  value={form.trainerId}
                  onChange={(e) => updateField('trainerId', e.target.value)}
                  disabled={!trainerSelectable || trainersLoading}
                  className={`${inputClass(fieldErrors.trainerId)} disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {!trainerSelectable
                      ? 'Chọn ngày và giờ trước'
                      : trainersLoading
                        ? 'Đang tải huấn luyện viên...'
                        : trainerOptions.length === 0
                          ? 'Không có HLV khả dụng'
                          : '-- Chọn huấn luyện viên --'}
                  </option>
                  {trainerOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Sức chứa tối đa" required error={fieldErrors.capacity}>
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => updateField('capacity', e.target.value)}
                  className={inputClass(fieldErrors.capacity)}
                />
              </Field>

              <Field label="Mô tả" error={fieldErrors.description}>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                  className={inputClass(fieldErrors.description)}
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
                  {saving
                    ? 'Đang lưu...'
                    : modal === 'edit'
                      ? 'Cập nhật lớp học'
                      : 'Lưu lớp học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm ngừng hoạt động */}
      {modal === 'confirm' && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <p className="text-gray-800">
                Bạn có chắc muốn ngừng lớp học này? Tất cả lịch tập tương lai của lớp sẽ bị hủy.
              </p>
              <p className="text-sm text-gray-500 mt-1">{selected.name}</p>
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

function ClassCard({ session }: { session: TimetableSession }) {
  return (
    <div className="bg-teal-50 border border-teal-200 rounded p-2 text-xs">
      <div className="font-semibold text-teal-800 break-words">{session.className}</div>
      <div className="text-teal-600 mt-0.5">{session.trainerName}</div>
      <div className="text-teal-600 mt-0.5">
        {hhmm(session.startTime)}–{hhmm(session.endTime)}
      </div>
      <div className="text-gray-500 mt-0.5">{session.availableSpots} chỗ</div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active
          ? 'border-teal-600 text-teal-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
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
