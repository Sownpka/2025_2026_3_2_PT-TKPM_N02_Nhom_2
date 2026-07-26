import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword, parseApiError } from '../api/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [bannerError, setBannerError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldError('')
    setBannerError('')
    setSuccessMessage('')
    setLoading(true)
    try {
      const res = await forgotPassword(email)
      setSuccessMessage(res.message)
    } catch (err) {
      const errors = parseApiError(err)
      const emailError = errors.find((e) => e.field === 'email')
      if (emailError) {
        setFieldError(emailError.message)
      } else {
        setBannerError(errors[0].message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
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

        {successMessage && (
          <div className="bg-green-50 border border-green-300 text-green-700 rounded p-3 text-sm mb-4">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                fieldError
                  ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
              }`}
            />
            {fieldError && <p className="text-red-600 text-sm mt-1">{fieldError}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white w-full py-2 rounded font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
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
