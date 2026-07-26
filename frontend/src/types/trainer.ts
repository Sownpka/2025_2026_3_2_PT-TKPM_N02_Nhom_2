import type { Status } from './index'

export interface TrainerResponse {
  id: number
  userAccountId: number
  fullName: string
  email: string
  specialty: string | null
  contactPhone: string | null
  status: Status
  totalMinutesThisWeek: number
}

export interface AvailableAccountResponse {
  id: number
  fullName: string
  email: string
}

export interface CreateTrainerRequest {
  userAccountId: number
  specialty: string
  contactPhone: string
}

// Sửa: không cho đổi tài khoản, chỉ specialty + contactPhone
export interface UpdateTrainerRequest {
  specialty: string
  contactPhone: string
}

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
export type SessionType = 'GROUP' | 'PRIVATE_1_1' | 'PRIVATE_1_2'

export interface ShiftSession {
  sessionId: number
  sessionDate: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  type: SessionType
  className: string
  durationMinutes: number
}

export interface TrainerShiftsResponse {
  week: string
  sessions: ShiftSession[]
}
