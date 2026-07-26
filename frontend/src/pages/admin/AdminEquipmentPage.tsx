import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { equipmentApi } from '../../api/equipment'
import { parseApiError } from '../../api/auth'
import type { EquipmentResponse } from '../../types/equipment'

type ModalType = 'add' | 'edit' | 'confirm' | null
type ToastType = 'success' | 'error'

interface FormState {
  code: string
  name: string
  type: string
  location: string
  note: string
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  type: '',
  location: '',
  note: '',
}

export default function AdminEquipmentPage() {
  const [items, setItems] = useState<EquipmentResponse[]>([])
  const [loading, setLoading] = useState(false)

  const [modal, setModal] = useState<ModalType>(null)
  const [selected, setSelected] = useState<EquipmentResponse | null>(null)

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
      const { data } = await equipmentApi.getAll()
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

  function openAddModal() {
    setSelected(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setModal('add')
  }

  function openEditModal(item: EquipmentResponse) {
    setSelected(item)
    setForm({
      code: item.code,
      name: item.name,
      type: item.type,
      location: item.location ?? '',
      note: item.note ?? '',
    })
    setFieldErrors({})
    setModal('edit')
  }

  function openConfirmModal(item: EquipmentResponse) {
    setSelected(item)
    setModal('confirm')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
  }

  // parseApiError chuẩn hóa cả 2 dạng lỗi backend về mảng ApiError:
  //  - Trùng mã (E-1): object đơn { field: 'code', message }
  //  - Thiếu trường (E-2): mảng [{ field, message }]
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
    const trimmedLocation = form.location.trim()
    const trimmedNote = form.note.trim()
    try {
      if (modal === 'edit' && selected) {
        // Sửa: KHÔNG gửi code (bất biến sau khi tạo)
        await equipmentApi.update(selected.id, {
          name: form.name.trim(),
          type: form.type.trim(),
          location: trimmedLocation || undefined,
          note: trimmedNote || undefined,
        })
        showToast('Cập nhật thành công!', 'success')
      } else {
        await equipmentApi.create({
          code: form.code.trim(),
          name: form.name.trim(),
          type: form.type.trim(),
          location: trimmedLocation || undefined,
          note: trimmedNote || undefined,
        })
        showToast('Thêm thiết bị thành công!', 'success')
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
      await equipmentApi.deactivate(selected.id)
      showToast('Đã ngừng hoạt động thiết bị.', 'success')
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
        <h1 className="text-lg font-semibold text-gray-800">Danh sách thiết bị</h1>
        <button
          onClick={openAddModal}
          className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 text-sm font-medium"
        >
          + Thêm thiết bị
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Mã thiết bị
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tên
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Loại
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Vị trí/Phòng
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Ghi chú
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.code}</td>
                <td className="px-4 py-3 text-sm text-gray-800">{item.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.type}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.location || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.note || '—'}</td>
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
          <div className="text-center py-8 text-gray-500">Chưa có thiết bị nào</div>
        )}
        {loading && <div className="text-center py-8 text-gray-400">Đang tải...</div>}
      </div>

      {/* Modal Thêm/Sửa */}
      {isFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {isEdit ? 'Chỉnh sửa thiết bị' : 'Thêm thiết bị'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <Field label="Mã thiết bị" required error={fieldErrors.code}>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateField('code', e.target.value)}
                  readOnly={isEdit}
                  className={
                    isEdit
                      ? 'w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed'
                      : inputClass(fieldErrors.code)
                  }
                />
              </Field>

              <Field label="Tên" required error={fieldErrors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={inputClass(fieldErrors.name)}
                />
              </Field>

              <Field label="Loại" required error={fieldErrors.type}>
                <input
                  type="text"
                  value={form.type}
                  onChange={(e) => updateField('type', e.target.value)}
                  placeholder="VD: Reformer, Mat, Chair"
                  className={inputClass(fieldErrors.type)}
                />
              </Field>

              <Field label="Vị trí/Phòng" error={fieldErrors.location}>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  className={inputClass(fieldErrors.location)}
                />
              </Field>

              <Field label="Ghi chú" error={fieldErrors.note}>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => updateField('note', e.target.value)}
                  className={inputClass(fieldErrors.note)}
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

      {/* Confirm Dialog Ngừng hoạt động */}
      {modal === 'confirm' && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <p className="text-gray-800">Bạn có chắc muốn ngừng thiết bị này?</p>
              <p className="text-sm text-gray-500 mt-1">
                {selected.code} — {selected.name}
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
