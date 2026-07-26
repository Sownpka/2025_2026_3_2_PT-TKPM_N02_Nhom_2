import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { loginUser, parseApiError } from '../api/auth'
import { useAuthStore } from '../stores/auth'
import type { Role } from '../types'

const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin/accounts',
  RECEPTIONIST: '/reception/members',
  TRAINER: '/trainer/schedule',
  MEMBER: '/member/booking',
}

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await loginUser(email, password)
      setAuth(res.token, res.role, res.fullName, res.email, res.userId)
      navigate(ROLE_HOME[res.role], { replace: true })
    } catch (err) {
      setError(parseApiError(err)[0].message)
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

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm mb-4">
            {error}
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
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-teal-600 text-sm hover:underline">
              Quên mật khẩu?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white w-full py-2 rounded font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}
