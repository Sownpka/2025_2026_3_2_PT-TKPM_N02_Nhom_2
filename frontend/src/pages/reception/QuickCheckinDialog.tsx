import { useState } from 'react'
import { quickCheckin, type QuickCheckinResponse } from '../../api/attendance'
import { parseApiError } from '../../api/auth'

interface QuickCheckinDialogProps {
  onClose: () => void
  onSuccess: (result: QuickCheckinResponse) => void
}

export default function QuickCheckinDialog({ onClose, onSuccess }: QuickCheckinDialogProps) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    const trimmed = phone.trim()
    if (!trimmed) {
      setError('Vui lòng nhập số điện thoại hội viên')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await quickCheckin(trimmed)
      onSuccess(result)
    } catch (err) {
      setError(parseApiError(err)[0].message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-800">Điểm danh nhanh</h2>
          <p className="text-xs text-gray-500 mt-1">
            Dành cho hội viên đến trực tiếp chưa đặt lịch. Xác nhận sẽ trừ 1 buổi từ gói còn hiệu lực.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số điện thoại hội viên
            </label>
            <input
              type="tel"
              value={phone}
              autoFocus
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) void handleConfirm()
              }}
              placeholder="Nhập số điện thoại"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={loading}
            className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận điểm danh'}
          </button>
        </div>
      </div>
    </div>
  )
}
