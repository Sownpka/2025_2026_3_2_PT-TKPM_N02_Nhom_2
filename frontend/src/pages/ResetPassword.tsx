import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword, parseApiError } from '../api/auth'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [bannerError, setBannerError] = useState('')
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setBannerError('')
    setLoading(true)
    try {
      const res = await resetPassword(token, newPassword, confirmPassword)
      setToast(res.message)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      const errors = parseApiError(err)
      const fieldMap: Record<string, string> = {}
      let generic = ''
      for (const e of errors) {
        if (e.field) fieldMap[e.field] = e.message
        else generic = e.message
      }
      setFieldErrors(fieldMap)
      if (generic) setBannerError(generic)
      else if (Object.keys(fieldMap).length === 0) setBannerError(errors[0].message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field: string) =>
    `w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
      fieldErrors[field]
        ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
        : 'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
    }`

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {toast && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-300 text-green-700 rounded p-3 text-sm shadow-md">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-8 max-w-sm w-full mx-auto">
        <div className="text-center mb-6">
          <div>
            <span className="text-teal-600 font-bold text-3xl">Pi</span>
            <span className="font-bold text-3xl">Core</span>
          </div>
          <p className="text-gray-500 text-sm text-center mt-1">
            Hệ thống Quản lý Phòng tập Pilates
          </p>
        </div>

        {bannerError && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm mb-4">
            {bannerError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu mới
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mật khẩu mới"
              required
              className={inputClass('newPassword')}
            />
            {fieldErrors.newPassword && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.newPassword}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nhập lại mật khẩu
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              required
              className={inputClass('confirmPassword')}
            />
            {fieldErrors.confirmPassword && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white w-full py-2 rounded font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
          </button>
        </form>

        <div className="text-center mt-4">
          <Link to="/login" className="text-teal-600 text-sm hover:underline">
            ← Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  )
}
