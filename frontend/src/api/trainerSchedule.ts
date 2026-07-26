import client from './client'
import { TRAINER_API } from './endpoints'

// Loại buổi học (khớp backend: GROUP / PRIVATE_1_1 / PRIVATE_1_2)
export type SessionType = 'GROUP' | 'PRIVATE_1_1' | 'PRIVATE_1_2'

// Tên thứ đầy đủ do backend trả về ("MONDAY".."SUNDAY")
export type BackendDayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export interface SessionItem {
  sessionId: number
  className: string
  sessionDate: string // "yyyy-MM-dd"
  dayOfWeek: BackendDayOfWeek // "MONDAY".."SUNDAY"
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  bookedCount: number
  capacity: number
  type: SessionType
}

export interface TrainerScheduleResponse {
  trainerName: string
  week: string // "YYYY-Www"
  sessions: SessionItem[]
}

// GET /api/trainer/schedule?week={week}
// Bỏ qua param week nếu undefined → backend dùng tuần hiện tại và trả week đã chuẩn hóa.
export async function fetchTrainerSchedule(
  week?: string
): Promise<TrainerScheduleResponse> {
  const { data } = await client.get<TrainerScheduleResponse>(TRAINER_API.SCHEDULE, {
    params: week ? { week } : undefined,
  })
  return data
}

// ===== UC5.5 — Danh sách học viên của một buổi học =====

// Thông tin buổi học (header trang)
export interface SessionInfo {
  sessionId: number
  className: string
  sessionDate: string // "yyyy-MM-dd"
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  trainerName: string
  isPast: boolean // sessionDate <= today
}

// Trạng thái booking (khớp backend)
export type BookingStatus = 'BOOKED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW'

// Một dòng hội viên trong danh sách
export interface AttendeeEntry {
  bookingId: number
  memberName: string
  phone: string | null
  bookingStatus: BookingStatus
  checkedInAt: string | null // ISO datetime, null khi chưa điểm danh
}

export interface SessionAttendeesResponse {
  sessionInfo: SessionInfo
  attendees: AttendeeEntry[]
}

// GET /api/trainer/sessions/{sessionId}/attendees
// Backend đã sort sẵn (BOOKED/ATTENDED/NO_SHOW trước, CANCELLED sau; trong nhóm theo memberName).
export async function fetchSessionAttendees(
  sessionId: number
): Promise<SessionAttendeesResponse> {
  const { data } = await client.get<SessionAttendeesResponse>(
    TRAINER_API.SESSION_ATTENDEES(sessionId)
  )
  return data
}
