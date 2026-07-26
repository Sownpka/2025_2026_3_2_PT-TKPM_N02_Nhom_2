import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createExpense, updateExpense } from '../../api/finance'
import type { CreateExpenseRequest, ExpenseItem } from '../../api/finance'
import { parseApiError } from '../../api/auth'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editingExpense: ExpenseItem | null
}

interface FieldErrors {
  amount?: string
  category?: string
  expenseDate?: string
}

// Ngày hôm nay dạng yyyy-MM-dd theo giờ địa phương (tránh lệch ngày UTC+7)
const todayISO = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ExpenseFormModal({ open, onClose, onSaved, editingExpense }: Props) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Prefill khi mở form (thêm hoặc sửa)
  useEffect(() => {
    if (!open) return
    if (editingExpense) {
      setCategory(editingExpense.category)
      setAmount(String(editingExpense.amount))
      setExpenseDate(editingExpense.expenseDate)
      setNote(editingExpense.note ?? '')
    } else {
      setCategory('')
      setAmount('')
      setExpenseDate(todayISO())
      setNote('')
    }
    setErrors({})
    setGeneralError('')
  }, [open, editingExpense])

  if (!open) return null

  function validate(): boolean {
    const next: FieldErrors = {}
    if (!category) next.category = 'Vui lòng chọn loại chi phí'
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) next.amount = 'Số tiền phải lớn hơn 0'
    if (!expenseDate) next.expenseDate = 'Vui lòng chọn ngày chi'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGeneralError('')
    if (!validate()) return
    setSubmitting(true)
    const req: CreateExpenseRequest = {
      category,
      amount: parseFloat(amount),
      expenseDate,
      note: note.trim() || undefined,
    }
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, req)
      } else {
        await createExpense(req)
      }
      onSaved()
      onClose()
    } catch (err) {
      // Map lỗi field từ backend (vd amount) + lỗi chung
      const apiErrors = parseApiError(err)
      const fieldMap: FieldErrors = {}
      let general = ''
      for (const ae of apiErrors) {
        if (ae.field && (ae.field === 'amount' || ae.field === 'category' || ae.field === 'expenseDate')) {
          fieldMap[ae.field as keyof FieldErrors] = ae.message
        } else {
          general = ae.message
        }
      }
      setErrors(fieldMap)
      if (general || Object.keys(fieldMap).length === 0) {
        setGeneralError(general || 'Đã có lỗi xảy ra. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {editingExpense ? 'Chỉnh sửa khoản chi' : 'Thêm khoản chi'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <Field label="Loại chi phí" required error={errors.category}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass(errors.category)}
            >
              <option value="">-- Chọn loại chi phí --</option>
              <option value="LUONG_HLV">Lương huấn luyện viên</option>
              <option value="CHI_PHI_THIET_BI">Chi phí thiết bị</option>
              <option value="CHI_PHI_VAN_HANH">Chi phí vận hành</option>
              <option value="KHAC">Khác</option>
            </select>
          </Field>

          <Field label="Số tiền" required error={errors.amount}>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0 ₫"
              className={inputClass(errors.amount)}
            />
          </Field>

          <Field label="Ngày chi" required error={errors.expenseDate}>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className={inputClass(errors.expenseDate)}
            />
          </Field>

          <Field label="Ghi chú">
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass()}
            />
          </Field>

          {generalError && <p className="text-sm text-red-500">{generalError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
            >
              {submitting ? 'Đang lưu...' : editingExpense ? 'Cập nhật' : 'Lưu'}
            </button>
          </div>
        </form>
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
