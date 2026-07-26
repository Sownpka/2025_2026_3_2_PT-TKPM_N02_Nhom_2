import client from './client'
import { DASHBOARD } from './endpoints'

export interface DashboardStats {
  totalMembers: number
  totalActivePackages: number
  totalTrainers: number
  totalEquipment: number
  revenueThisMonth: number
  expenseThisMonth: number
  sessionsTodayCount: number
}

export async function fetchDashboard(): Promise<DashboardStats> {
  const res = await client.get<DashboardStats>(DASHBOARD.BASE)
  return res.data
}
