import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { packageTypesApi } from '../../api/packageTypes'
import { parseApiError } from '../../api/auth'
import type { PackageTypeResponse, Status } from '../../types'

type ModalType = 'add' | 'edit' | 'confirm' | null
type ToastType = 'success' | 'error'

const CATEGORY_LABEL: Record<string, string> = {
  THEO_BUOI: 'Theo buổi',
  THEO_THANG: 'Theo tháng',
  KHONG_GIOI_HAN: 'Không giới hạn',
  GOI_1_1: 'Gói 1-1',
  GOI_1_2: 'Gói 1-2',
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Chọn phân loại' },
  { value: 'THEO_BUOI', label: 'Theo buổi' },
  { value: 'THEO_THANG', label: 'Theo tháng' },
  { value: 'KHONG_GIOI_HAN', label: 'Không giới hạn' },
  { value: 'GOI_1_1', label: 'Gói 1-1' },
  { value: 'GOI_1_2', label: 'Gói 1-2' },
]

// Danh mục yêu cầu nhập số buổi
const SESSION_CATEGORIES = new Set(['THEO_BUOI', 'GOI_1_1', 'GOI_1_2'])

const STATUS_PILL: Record<Status, { className: string; label: string }> = {
  ACTIVE: { className: 'bg-green-100 text-green-700', label: 'Đang áp dụng' },
  INACTIVE: { className: 'bg-gray-100 text-gray-500', label: 'Ngừng áp dụng' },
}

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})

function StatusPill({ status }: { status: Status }) {
  const pill = STATUS_PILL[status]
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${pill.className}`}>
      {pill.label}
    </span>
  )
}

interface FormState {
  name: string
  category: string
  sessions: string
  durationDays: string
  price: string
  description: string
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  sessions: '',
  durationDays: '',
  price: '',
  description: '',
}

export default function AdminPackageTypesPage() {
  const [items, setItems] = useState<PackageTypeResponse[]>([])
  const [loading, setLoading] = useState(false)

  const [modal, setModal] = useState<ModalType>(null)
  const [selected, setSelected] = useState<PackageTypeResponse | null>(null)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await packageTypesApi.getAll()
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

  const showSessions = SESSION_CATEGORIES.has(form.category)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleCategoryChange(value: string) {
    setForm((prev) => ({
      ...prev,
      category: value,
      // Khi phân loại không yêu cầu số buổi -> xóa giá trị số buổi
      sessions: SESSION_CATEGORIES.has(value) ? prev.sessions : '',
    }))
  }

  function openAddModal() {
    setSelected(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setModal('add')
  }

  function openEditModal(item: PackageTypeResponse) {
    setSelected(item)
    setForm({
      name: item.name,
      category: item.category,
      sessions: item.sessions != null ? String(item.sessions) : '',
      durationDays: String(item.durationDays),
      price: String(item.price),
      description: item.description ?? '',
    })
    setFieldErrors({})
    setModal('edit')
  }

  function openConfirmModal(item: PackageTypeResponse) {
    setSelected(item)
    setModal('confirm')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
  }

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
    const includeSessions = SESSION_CATEGORIES.has(form.category)
    const payload = {
      name: form.name.trim(),
      category: form.category,
      sessions: includeSessions && form.sessions !== '' ? Number(form.sessions) : null,
      durationDays: form.durationDays !== '' ? Number(form.durationDays) : NaN,
      price: form.price !== '' ? Number(form.price) : NaN,
      description: form.description.trim() || undefined,
    }
    try {
      if (modal === 'edit' && selected) {
        await packageTypesApi.update(selected.id, payload)
        showToast('Cập nhật loại gói thành công', 'success')
      } else {
        await packageTypesApi.create(payload)
        showToast('Thêm loại gói thành công', 'success')
      }
      closeModal()
      await loadItems()
    } catch (err) {
      applyErrors(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmToggle() {
    if (!selected) return
    try {
      await packageTypesApi.toggleStatus(selected.id)
      showToast('Ngừng áp dụng loại gói thành công', 'success')
      closeModal()
      await loadItems()
    } catch (err) {
      closeModal()
      showToast(parseApiError(err)[0].message, 'error')
    }
  }

  const isFormModal = modal === 'add' || modal === 'edit'
  const isEdit = modal === 'edit'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">Loại gói tập</h1>
        <button
          onClick={openAddModal}
          className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 text-sm font-medium"
        >
          + Thêm loại gói
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tên gói
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Phân loại
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Số buổi
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Thời hạn (ngày)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Giá
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
                <td className="px-4 py-3 text-sm text-gray-800">{item.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {item.sessions != null ? item.sessions : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.durationDays}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {currencyFormatter.format(item.price)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={item.status} />
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => openEditModal(item)}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Sửa
                  </button>
                  {item.status === 'ACTIVE' ? (
                    <button
                      onClick={() => openConfirmModal(item)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium"
                    >
                      Ngừng áp dụng
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 px-3 py-1 inline-block">
                      Đã ngừng
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">Chưa có loại gói tập nào</div>
        )}
        {loading && <div className="text-center py-8 text-gray-400">Đang tải...</div>}
      </div>

      {/* Modal Thêm/Sửa */}
      {isFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {isEdit ? 'Chỉnh sửa loại gói' : 'Thêm loại gói'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <Field label="Tên gói" required error={fieldErrors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={inputClass(fieldErrors.name)}
                />
              </Field>

              <Field label="Phân loại" required error={fieldErrors.category}>
                <select
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={inputClass(fieldErrors.category)}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              {showSessions && (
                <Field label="Số buổi" error={fieldErrors.sessions}>
                  <input
                    type="number"
                    min={0}
                    value={form.sessions}
                    onChange={(e) => updateField('sessions', e.target.value)}
                    className={inputClass(fieldErrors.sessions)}
                  />
                </Field>
              )}

              <Field label="Thời hạn (ngày)" required error={fieldErrors.durationDays}>
                <input
                  type="number"
                  min={0}
                  value={form.durationDays}
                  onChange={(e) => updateField('durationDays', e.target.value)}
                  className={inputClass(fieldErrors.durationDays)}
                />
              </Field>

              <Field label="Giá" required error={fieldErrors.price}>
                <input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  className={inputClass(fieldErrors.price)}
                />
              </Field>

              <Field label="Mô tả" error={fieldErrors.description}>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
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
                  {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog Ngừng áp dụng */}
      {modal === 'confirm' && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <p className="text-gray-800">
                Bạn có chắc muốn ngừng áp dụng loại gói này? Các gói hội viên đã mua vẫn được
                giữ nguyên.
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
                onClick={handleConfirmToggle}
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
