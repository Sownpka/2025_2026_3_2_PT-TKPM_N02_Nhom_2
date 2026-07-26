import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  fetchFinanceReport,
  fetchComparison,
  deleteExpense,
} from '../../api/finance'
import type {
  FinanceReportResponse,
  MonthComparisonItem,
  ExpenseItem,
} from '../../api/finance'
import { parseApiError } from '../../api/auth'
import ExpenseFormModal from './ExpenseFormModal'

// ===== Helpers định dạng =====
const formatVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

// "YYYY-MM" -> "Tháng M/YYYY"
const toMonthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `Tháng ${parseInt(m, 10)}/${y}`
}

// "yyyy-MM-dd" -> "dd/MM/yyyy"
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Thao tác trên chuỗi "YYYY-MM"
function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1 - 1, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1 + 1, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const activeTab = 'px-4 py-2 rounded text-sm font-medium bg-teal-600 text-white'
const inactiveTab =
  'px-4 py-2 rounded text-sm font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'

export default function FinancePage() {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [report, setReport] = useState<FinanceReportResponse | null>(null)
  const [comparison, setComparison] = useState<MonthComparisonItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'expenses' | 'comparison'>('expenses')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Fetch report khi đổi tháng
  useEffect(() => {
    let active = true
    setLoading(true)
    fetchFinanceReport(currentMonth)
      .then((d) => {
        if (active) setReport(d)
      })
      .catch(() => {
        if (active) setReport(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentMonth])

  // Fetch comparison khi chuyển sang tab so sánh (1 lần)
  useEffect(() => {
    if (tab !== 'comparison' || comparison) return
    let active = true
    fetchComparison(6)
      .then((d) => {
        if (active) setComparison(d)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [tab, comparison])

  // Tự ẩn toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  function reloadReport() {
    let active = true
    fetchFinanceReport(currentMonth)
      .then((d) => {
        if (active) setReport(d)
      })
      .catch(() => {})
    return active
  }

  async function handleDelete(id: number) {
    try {
      await deleteExpense(id)
      setShowDeleteConfirm(null)
      reloadReport()
      setToast({ message: 'Đã xóa khoản chi.', type: 'success' })
    } catch (err) {
      setShowDeleteConfirm(null)
      setToast({ message: parseApiError(err)[0].message, type: 'error' })
    }
  }

  function openAddExpense() {
    setEditingExpense(null)
    setShowExpenseForm(true)
  }

  function openEditExpense(expense: ExpenseItem) {
    setEditingExpense(expense)
    setShowExpenseForm(true)
  }

  function handleExpenseSaved() {
    reloadReport()
    setToast({ message: 'Đã lưu khoản chi.', type: 'success' })
  }

  return (
    <div className="space-y-4">
      {/* Header + bộ chọn tháng */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">Báo cáo tài chính</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth(prevMonth(currentMonth))}
            className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
          >
            ◀
          </button>
          <span className="text-sm font-medium text-gray-800 min-w-[110px] text-center">
            {toMonthLabel(currentMonth)}
          </span>
          <button
            onClick={() => setCurrentMonth(nextMonth(currentMonth))}
            className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
          >
            ▶
          </button>
        </div>
      </div>

      {/* 3 card tổng quan */}
      {report && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-5 shadow">
            <div className="text-sm text-gray-500 mb-1">Tổng thu</div>
            <div className="text-2xl font-bold text-green-600">
              {formatVND(report.totalRevenue)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-5 shadow">
            <div className="text-sm text-gray-500 mb-1">Tổng chi</div>
            <div className="text-2xl font-bold text-red-600">
              {formatVND(report.totalExpense)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-5 shadow">
            <div className="text-sm text-gray-500 mb-1">Lợi nhuận</div>
            <div
              className={`text-2xl font-bold ${
                report.profit >= 0 ? 'text-teal-600' : 'text-red-600'
              }`}
            >
              {formatVND(report.profit)}
            </div>
          </div>
        </div>
      )}

      {loading && !report && (
        <div className="text-center py-8 text-gray-400">Đang tải...</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('expenses')}
          className={tab === 'expenses' ? activeTab : inactiveTab}
        >
          Khoản chi
        </button>
        <button
          onClick={() => setTab('comparison')}
          className={tab === 'comparison' ? activeTab : inactiveTab}
        >
          So sánh theo tháng
        </button>
      </div>

      {/* Tab Khoản chi */}
      {tab === 'expenses' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={openAddExpense}
              className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 text-sm font-medium"
            >
              + Thêm khoản chi
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Loại
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Số tiền
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ngày chi
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
                {report?.expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-800">{expense.categoryLabel}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {formatVND(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(expense.expenseDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{expense.note || '—'}</td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openEditExpense(expense)}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded text-xs font-medium"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(expense.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report && report.expenses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Chưa có khoản chi nào trong tháng này
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab So sánh theo tháng */}
      {tab === 'comparison' && (
        <div className="bg-white rounded-lg shadow p-5">
          {comparison ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip formatter={(value) => formatVND(Number(value))} />
                <Legend />
                <Bar dataKey="revenue" name="Doanh thu" fill="#0D9488" />
                <Bar dataKey="expense" name="Chi phí" fill="#EF4444" />
                <Bar dataKey="profit" name="Lợi nhuận" fill="#22C55E" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-400">Đang tải biểu đồ...</div>
          )}
        </div>
      )}

      {/* Modal thêm/sửa khoản chi */}
      <ExpenseFormModal
        open={showExpenseForm}
        onClose={() => setShowExpenseForm(false)}
        onSaved={handleExpenseSaved}
        editingExpense={editingExpense}
      />

      {/* Dialog xác nhận xóa */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <p className="mb-4 text-gray-800">Bạn có chắc muốn xóa khoản chi này?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 rounded bg-red-500 text-white text-sm font-medium hover:bg-red-600"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
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
