import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  getAccounts,
  createAccount,
  updateAccount,
  toggleAccountStatus,
} from '../../api/accounts'
import { getMembersWithoutAccount } from '../../api/members'
import { parseApiError } from '../../api/auth'
import Toast from '../../components/Toast'
import type { AccountResponse, MemberResponse, Role, Status } from '../../types'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Quản trị viên' },
  { value: 'RECEPTIONIST', label: 'Lễ tân' },
  { value: 'TRAINER', label: 'Huấn luyện viên' },
  { value: 'MEMBER', label: 'Hội viên' },
]

const ROLE_PILL: Record<Role, { className: string; label: string }> = {
  ADMIN: { className: 'bg-teal-100 text-teal-700', label: 'Quản trị viên' },
  RECEPTIONIST: { className: 'bg-blue-100 text-blue-700', label: 'Lễ tân' },
  TRAINER: { className: 'bg-purple-100 text-purple-700', label: 'Huấn luyện viên' },
  MEMBER: { className: 'bg-green-100 text-green-700', label: 'Hội viên' },
}

const STATUS_PILL: Record<Status, { className: string; label: string }> = {
  ACTIVE: { className: 'bg-green-100 text-green-700', label: 'Hoạt động' },
  INACTIVE: { className: 'bg-gray-100 text-gray-500', label: 'Ngừng hoạt động' },
}

function RolePill({ role }: { role: Role }) {
  const pill = ROLE_PILL[role]
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${pill.className}`}>
      {pill.label}
    </span>
  )
}

function StatusPill({ status }: { status: Status }) {
  const pill = STATUS_PILL[status]
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${pill.className}`}>
      {pill.label}
    </span>
  )
}

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
]

interface FormState {
  fullName: string
  email: string
  phone: string
  role: Role
  status: Status
  password: string
  confirmPassword: string
  memberId: number | null
}

const EMPTY_FORM: FormState = {
  fullName: '',
  email: '',
  phone: '',
  role: 'MEMBER',
  status: 'ACTIVE',
  password: '',
  confirmPassword: '',
  memberId: null,
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AccountResponse[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<AccountResponse | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmTarget, setConfirmTarget] = useState<AccountResponse | null>(null)
  const [toast, setToast] = useState('')
  const [membersWithoutAccount, setMembersWithoutAccount] = useState<MemberResponse[]>([])

  const isEdit = selectedAccount !== null

  const loadAccounts = useCallback(async (searchTerm: string) => {
    setLoading(true)
    try {
      const data = await getAccounts(searchTerm.trim() || undefined)
      setAccounts(data)
    } catch (err) {
      setToast('')
      setAccounts([])
      console.error(parseApiError(err)[0].message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce tìm kiếm 300ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void loadAccounts(search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, loadAccounts])

  function openAddModal() {
    setSelectedAccount(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormError('')
    setModalOpen(true)
    // Tải danh sách hội viên chưa có tài khoản
    getMembersWithoutAccount()
      .then(setMembersWithoutAccount)
      .catch(() => setMembersWithoutAccount([]))
  }

  function handleSelectMember(memberId: string) {
    if (!memberId) {
      setForm((prev) => ({ ...prev, memberId: null, fullName: '', email: '', phone: '' }))
      return
    }
    const member = membersWithoutAccount.find((m) => String(m.id) === memberId)
    if (!member) return
    setForm((prev) => ({
      ...prev,
      memberId: member.id,
      fullName: member.fullName,
      email: member.email ?? '',
      phone: member.phone ?? '',
    }))
  }

  function openEditModal(account: AccountResponse) {
    setSelectedAccount(account)
    setForm({
      fullName: account.fullName,
      email: account.email,
      phone: account.phone ?? '',
      role: account.role,
      status: account.status,
      password: '',
      confirmPassword: '',
    })
    setFieldErrors({})
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelectedAccount(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormError('')
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
      setFormError(general || 'Đã có lỗi xảy ra. Vui lòng thử lại.')
    } else {
      setFormError('')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')
    setSaving(true)
    try {
      if (isEdit && selectedAccount) {
        await updateAccount(selectedAccount.id, {
          fullName: form.fullName,
          phone: form.phone || undefined,
          role: form.role,
          status: form.status,
        })
        setToast('Cập nhật tài khoản thành công')
      } else {
        await createAccount({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          role: form.role,
          password: form.password,
          confirmPassword: form.confirmPassword,
          memberId: form.memberId ?? undefined,
        })
        setToast('Thêm tài khoản thành công')
      }
      closeModal()
      await loadAccounts(search)
    } catch (err) {
      applyErrors(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmToggle() {
    if (!confirmTarget) return
    try {
      await toggleAccountStatus(confirmTarget.id)
      setToast('Vô hiệu hóa tài khoản thành công')
      setConfirmTarget(null)
      await loadAccounts(search)
    } catch (err) {
      setToast('')
      setFormError(parseApiError(err)[0].message)
      setConfirmTarget(null)
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên, email..."
          className="border border-gray-300 rounded px-3 py-2 w-64 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
        <button
          onClick={openAddModal}
          className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 text-sm font-medium"
        >
          + Thêm tài khoản
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
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
                SĐT
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Vai trò
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
            {accounts.map((acc) => (
              <tr key={acc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-800">{acc.fullName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{acc.email}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{acc.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <RolePill role={acc.role} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={acc.status} />
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => openEditModal(acc)}
                    className="text-white px-3 py-1 rounded text-xs font-medium"
                    style={{ backgroundColor: '#F59E0B' }}
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => setConfirmTarget(acc)}
                    disabled={acc.status === 'INACTIVE'}
                    className="text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#EF4444' }}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">Không tìm thấy tài khoản</div>
        )}
        {loading && (
          <div className="text-center py-8 text-gray-400">Đang tải...</div>
        )}
      </div>

      {/* Modal Thêm/Sửa */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {isEdit ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm">
                  {formError}
                </div>
              )}

              {/* Chọn hội viên chưa có tài khoản (chỉ khi thêm mới) */}
              {!isEdit && (
                <Field
                  label="Liên kết hội viên"
                  hint="Chọn hội viên để tự điền thông tin. Bỏ trống nếu tạo tài khoản độc lập."
                >
                  <select
                    value={form.memberId ?? ''}
                    onChange={(e) => handleSelectMember(e.target.value)}
                    className={inputClass()}
                  >
                    <option value="">-- Không liên kết (tài khoản độc lập) --</option>
                    {membersWithoutAccount.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} · {m.phone}
                        {m.email ? ` · ${m.email}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Họ tên" required error={fieldErrors.fullName}>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  className={inputClass(fieldErrors.fullName)}
                />
              </Field>

              <Field
                label="Email"
                required
                error={fieldErrors.email}
                hint="Dùng làm tên đăng nhập"
              >
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  readOnly={isEdit}
                  className={`${inputClass(fieldErrors.email)} ${
                    isEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                  }`}
                />
              </Field>

              <Field label="Số điện thoại" error={fieldErrors.phone}>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className={inputClass(fieldErrors.phone)}
                />
              </Field>

              <Field label="Vai trò" required error={fieldErrors.role}>
                <select
                  value={form.role}
                  onChange={(e) => updateField('role', e.target.value as Role)}
                  className={inputClass(fieldErrors.role)}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              {isEdit && (
                <Field label="Trạng thái" required error={fieldErrors.status}>
                  <select
                    value={form.status}
                    onChange={(e) => updateField('status', e.target.value as Status)}
                    className={inputClass(fieldErrors.status)}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {!isEdit && (
                <>
                  <Field label="Mật khẩu" required error={fieldErrors.password}>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      className={inputClass(fieldErrors.password)}
                    />
                  </Field>

                  <Field
                    label="Nhập lại mật khẩu"
                    required
                    error={fieldErrors.confirmPassword}
                  >
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                      className={inputClass(fieldErrors.confirmPassword)}
                    />
                  </Field>
                </>
              )}

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

      {/* ConfirmDialog xóa (vô hiệu hóa) */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <p className="text-gray-800">
                Bạn có chắc muốn vô hiệu hóa tài khoản này?
              </p>
              <p className="text-sm text-gray-500 mt-1">{confirmTarget.fullName}</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                onClick={() => setConfirmTarget(null)}
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

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
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
  hint?: string
  children: React.ReactNode
}

function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
