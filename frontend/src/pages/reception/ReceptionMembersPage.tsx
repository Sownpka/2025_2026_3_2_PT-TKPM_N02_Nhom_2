import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  getMembers,
  createMember,
  updateMember,
  toggleMemberStatus,
  getMemberDetail,
} from '../../api/members'
import { parseApiError } from '../../api/auth'
import Toast from '../../components/Toast'
import type {
  MemberResponse,
  MemberDetailResponse,
  Status,
  Gender,
} from '../../types'

type ModalType = 'add' | 'edit' | 'detail' | 'confirm' | null

const STATUS_PILL: Record<Status, { className: string; label: string }> = {
  ACTIVE: { className: 'bg-green-100 text-green-700', label: 'Hoạt động' },
  INACTIVE: { className: 'bg-gray-100 text-gray-500', label: 'Ngừng hoạt động' },
}

const GENDER_LABEL: Record<Gender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
}

const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Chọn giới tính' },
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' },
]

function StatusPill({ status }: { status: Status }) {
  const pill = STATUS_PILL[status]
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${pill.className}`}>
      {pill.label}
    </span>
  )
}

function formatDob(dob: string | null): string {
  if (!dob) return '—'
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN')
}

function genderLabel(gender: Gender | null): string {
  return gender ? GENDER_LABEL[gender] : '—'
}

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
]

interface FormState {
  fullName: string
  phone: string
  email: string
  dob: string
  gender: string
  note: string
  status: Status
}

const EMPTY_FORM: FormState = {
  fullName: '',
  phone: '',
  email: '',
  dob: '',
  gender: '',
  note: '',
  status: 'ACTIVE',
}

export default function ReceptionMembersPage() {
  const [members, setMembers] = useState<MemberResponse[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [modal, setModal] = useState<ModalType>(null)
  const [selected, setSelected] = useState<MemberResponse | null>(null)
  const [detail, setDetail] = useState<MemberDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const loadMembers = useCallback(async (searchTerm: string) => {
    setLoading(true)
    try {
      const data = await getMembers(searchTerm.trim() || undefined)
      setMembers(data)
    } catch (err) {
      setMembers([])
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
      void loadMembers(search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, loadMembers])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openAddModal() {
    setSelected(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormError('')
    setModal('add')
  }

  function openEditModal(member: MemberResponse) {
    setSelected(member)
    setForm({
      fullName: member.fullName,
      phone: member.phone,
      email: member.email,
      dob: member.dob ?? '',
      gender: member.gender ?? '',
      note: member.note ?? '',
      status: member.status,
    })
    setFieldErrors({})
    setFormError('')
    setModal('edit')
  }

  async function openDetailModal(member: MemberResponse) {
    setSelected(member)
    setDetail(null)
    setDetailLoading(true)
    setModal('detail')
    try {
      const data = await getMemberDetail(member.id)
      setDetail(data)
    } catch (err) {
      setModal(null)
      setToast('Không thể tải thông tin chi tiết. Vui lòng thử lại.')
    } finally {
      setDetailLoading(false)
    }
  }

  function openConfirmModal(member: MemberResponse) {
    setSelected(member)
    setModal('confirm')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setDetail(null)
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
      if (modal === 'edit' && selected) {
        await updateMember(selected.id, {
          fullName: form.fullName,
          phone: form.phone,
          dob: form.dob || undefined,
          gender: form.gender || undefined,
          note: form.note || undefined,
          status: form.status,
        })
        setToast('Cập nhật hội viên thành công')
      } else {
        await createMember({
          fullName: form.fullName,
          phone: form.phone,
          email: form.email || undefined,
          dob: form.dob || undefined,
          gender: form.gender || undefined,
          note: form.note || undefined,
        })
        setToast('Thêm hội viên thành công')
      }
      closeModal()
      await loadMembers(search)
    } catch (err) {
      applyErrors(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmToggle() {
    if (!selected) return
    try {
      await toggleMemberStatus(selected.id)
      setToast('Ngừng kích hoạt hội viên thành công')
      closeModal()
      await loadMembers(search)
    } catch (err) {
      setToast('')
      setFormError(parseApiError(err)[0].message)
      closeModal()
    }
  }

  const isFormModal = modal === 'add' || modal === 'edit'
  const isEdit = modal === 'edit'

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên, SĐT..."
          className="border border-gray-300 rounded px-3 py-2 w-64 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
        <button
          onClick={openAddModal}
          className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 text-sm font-medium"
        >
          + Thêm hội viên
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
                SĐT
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Ngày sinh
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Giới tính
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
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-800">{m.fullName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{m.phone}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{m.email}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatDob(m.dob)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{genderLabel(m.gender)}</td>
                <td className="px-4 py-3">
                  <StatusPill status={m.status} />
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => openDetailModal(m)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Chi tiết
                  </button>
                  <button
                    onClick={() => openEditModal(m)}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => openConfirmModal(m)}
                    disabled={m.status === 'INACTIVE'}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">Không tìm thấy hội viên</div>
        )}
        {loading && <div className="text-center py-8 text-gray-400">Đang tải...</div>}
      </div>

      {/* Modal Thêm/Sửa (S-1 / S-2) */}
      {isFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {isEdit ? 'Sửa hội viên' : 'Thêm hội viên'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm">
                  {formError}
                </div>
              )}

              <Field label="Họ tên" required error={fieldErrors.fullName}>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  className={inputClass(fieldErrors.fullName)}
                />
              </Field>

              <Field label="Số điện thoại" required error={fieldErrors.phone}>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className={inputClass(fieldErrors.phone)}
                />
              </Field>

              <Field
                label="Email"
                error={fieldErrors.email}
                hint={isEdit ? undefined : 'Tùy chọn — có thể liên kết tài khoản sau'}
              >
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  readOnly={isEdit}
                  className={`${inputClass(fieldErrors.email)} ${
                    isEdit ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                  }`}
                />
              </Field>

              <Field label="Ngày sinh" error={fieldErrors.dob}>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => updateField('dob', e.target.value)}
                  className={inputClass(fieldErrors.dob)}
                />
              </Field>

              <Field label="Giới tính" error={fieldErrors.gender}>
                <select
                  value={form.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                  className={inputClass(fieldErrors.gender)}
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Ghi chú" error={fieldErrors.note}>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => updateField('note', e.target.value)}
                  className={inputClass(fieldErrors.note)}
                />
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

      {/* Modal Chi tiết (S-3) */}
      {modal === 'detail' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Chi tiết hội viên</h2>
            </div>
            <div className="px-6 py-4 space-y-6">
              {detailLoading && (
                <div className="text-center py-8 text-gray-400">Đang tải...</div>
              )}
              {!detailLoading && detail && (
                <>
                  {/* Thông tin cá nhân */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Thông tin cá nhân
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <InfoRow label="Họ tên" value={detail.member.fullName} />
                      <InfoRow label="SĐT" value={detail.member.phone} />
                      <InfoRow label="Email" value={detail.member.email} />
                      <InfoRow label="Ngày sinh" value={formatDob(detail.member.dob)} />
                      <InfoRow label="Giới tính" value={genderLabel(detail.member.gender)} />
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Trạng thái:</span>
                        <StatusPill status={detail.member.status} />
                      </div>
                      <InfoRow
                        label="Ghi chú"
                        value={detail.member.note ?? '—'}
                        full
                      />
                    </div>
                  </section>

                  {/* Gói tập hiện tại */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Gói tập hiện tại
                    </h3>
                    {detail.activePackages.length === 0 ? (
                      <p className="text-sm text-gray-500">Chưa có gói tập nào</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.activePackages.map((pkg) => (
                          <div
                            key={pkg.id}
                            className="flex items-center justify-between border border-gray-200 rounded px-3 py-2 text-sm"
                          >
                            <div>
                              <div className="font-medium text-gray-800">
                                {pkg.packageName}
                              </div>
                              <div className="text-gray-500 text-xs">
                                Còn {pkg.sessionsRemaining} buổi · Hết hạn{' '}
                                {formatDob(pkg.endDate)}
                              </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                              {pkg.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Lịch sử tập luyện */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Lịch sử tập luyện
                    </h3>
                    {detail.bookingHistory.length === 0 ? (
                      <p className="text-sm text-gray-500">Chưa có lịch sử tập luyện</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.bookingHistory.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between border border-gray-200 rounded px-3 py-2 text-sm"
                          >
                            <div>
                              <div className="font-medium text-gray-800">{b.className}</div>
                              <div className="text-gray-500 text-xs">
                                HLV: {b.trainerName} · {formatDob(b.sessionDate)}
                              </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              {b.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog Xóa (S-4) */}
      {modal === 'confirm' && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <p className="text-gray-800">
                Bạn có chắc muốn ngừng kích hoạt hội viên này?
              </p>
              <p className="text-sm text-gray-500 mt-1">{selected.fullName}</p>
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
  children: ReactNode
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

function InfoRow({
  label,
  value,
  full,
}: {
  label: string
  value: string
  full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <span className="text-gray-500">{label}:</span>{' '}
      <span className="text-gray-800">{value}</span>
    </div>
  )
}
