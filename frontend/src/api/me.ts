import client from './client'
import { ME } from './endpoints'
import type { PackageCategory } from '../types'

export type MyPackageStatus = 'ACTIVE' | 'EXPIRED' | 'USED_UP'

export interface MyPackageResponse {
  id: number
  packageTypeName: string
  category: PackageCategory
  sessionsRemaining: number | null
  startDate: string // "yyyy-MM-dd"
  endDate: string // "yyyy-MM-dd"
  status: MyPackageStatus
  nearExpiry: boolean
}

export type HistoryFilter = 'WEEK' | 'MONTH' | 'CUSTOM'
export type AttendanceStatus = 'ATTENDED' | 'NO_SHOW'

export interface MyHistoryItem {
  sessionDate: string // "yyyy-MM-dd"
  className: string
  trainerName: string
  startTime: string // "HH:mm:ss"
  endTime: string // "HH:mm:ss"
  attendanceStatus: AttendanceStatus
}

export async function fetchMyPackages(): Promise<MyPackageResponse[]> {
  const { data } = await client.get<MyPackageResponse[]>(ME.PACKAGES)
  return data
}

export async function fetchMyHistory(
  filter: HistoryFilter,
  from?: string,
  to?: string
): Promise<MyHistoryItem[]> {
  const params: Record<string, string> = { filter }
  if (filter === 'CUSTOM') {
    if (from) params.from = from
    if (to) params.to = to
  }
  const { data } = await client.get<MyHistoryItem[]>(ME.HISTORY, { params })
  return data
}
