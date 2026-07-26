import client from './client'
import { FINANCE } from './endpoints'

// ===== Giao dịch thu (từ package_transaction) =====
export interface TransactionItem {
  id: number
  memberName: string
  packageTypeName: string
  amount: number
  type: 'NEW' | 'RENEWAL'
  createdAt: string
}

// ===== Khoản chi =====
export interface ExpenseItem {
  id: number
  category: string
  categoryLabel: string
  amount: number
  expenseDate: string // "yyyy-MM-dd"
  note: string | null
  createdAt: string
}

// ===== GET /finance/report =====
export interface FinanceReportResponse {
  month: string
  totalRevenue: number
  totalExpense: number
  profit: number
  transactions: TransactionItem[]
  expenses: ExpenseItem[]
}

// ===== GET /finance/comparison =====
export interface MonthComparisonItem {
  month: string
  monthLabel: string
  revenue: number
  expense: number
  profit: number
}

// ===== POST/PUT /finance/expenses =====
export interface CreateExpenseRequest {
  category: string // enum name: "LUONG_HLV" | "CHI_PHI_THIET_BI" | "CHI_PHI_VAN_HANH" | "KHAC"
  amount: number
  expenseDate: string // "yyyy-MM-dd"
  note?: string
}

export type ExpenseResponse = ExpenseItem

// Báo cáo tài chính theo tháng (3 card + danh sách thu/chi)
export async function fetchFinanceReport(month: string): Promise<FinanceReportResponse> {
  const { data } = await client.get<FinanceReportResponse>(FINANCE.REPORT, { params: { month } })
  return data
}

// So sánh nhiều tháng (biểu đồ cột)
export async function fetchComparison(months = 6): Promise<MonthComparisonItem[]> {
  const { data } = await client.get<MonthComparisonItem[]>(FINANCE.COMPARISON, {
    params: { months },
  })
  return data
}

// Thêm khoản chi
export async function createExpense(req: CreateExpenseRequest): Promise<ExpenseResponse> {
  const { data } = await client.post<ExpenseResponse>(FINANCE.EXPENSES, req)
  return data
}

// Sửa khoản chi
export async function updateExpense(
  id: number,
  req: CreateExpenseRequest
): Promise<ExpenseResponse> {
  const { data } = await client.put<ExpenseResponse>(FINANCE.EXPENSE_BY_ID(id), req)
  return data
}

// Xóa cứng khoản chi
export async function deleteExpense(id: number): Promise<void> {
  await client.delete(FINANCE.EXPENSE_BY_ID(id))
}
