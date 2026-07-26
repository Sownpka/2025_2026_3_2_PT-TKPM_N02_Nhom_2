import client from './client'
import { ATTENDANCE } from './endpoints'

// ===== Trạng thái điểm danh =====
export type AttendeeBookingStatus = 'BOOKED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED'

// ===== GET /attendance/today =====
export interface SessionSummary {
  sessionId: number
  className: string
  trainerName: string | null
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  capacity: number
  bookedCount: number
  checkedInCount: number
}

// ===== GET /attendance/{sessionId}/attendees =====
export interface AttendeeItem {
  bookingId: number
  memberId: number
  memberName: string
  packageTypeName: string | null
  sessionsRemaining: number | null
  bookingStatus: AttendeeBookingStatus
}

// ===== POST /attendance/{bookingId}/check-in | /no-show =====
export interface CheckInResponse {
  bookingId: number
  status: string
  checkedInAt: string | null
}

// ===== POST /attendance/quick-checkin =====
export interface QuickCheckinResponse {
  memberName: string
  packageTypeName: string | null
  sessionsRemaining: number | null
}

// Danh sách buổi học hôm nay (RECEPTIONIST)
export async function fetchTodaySessions(): Promise<SessionSummary[]> {
  const { data } = await client.get<SessionSummary[]>(ATTENDANCE.TODAY)
  return data
}

// Danh sách hội viên đã đặt của 1 buổi
export async function fetchAttendees(sessionId: number): Promise<AttendeeItem[]> {
  const { data } = await client.get<AttendeeItem[]>(ATTENDANCE.ATTENDEES(sessionId))
  return data
}

// Điểm danh "Có mặt"
export async function checkIn(bookingId: number): Promise<CheckInResponse> {
  const { data } = await client.post<CheckInResponse>(ATTENDANCE.CHECK_IN(bookingId))
  return data
}

// Đánh dấu "No-show"
export async function markNoShow(bookingId: number): Promise<CheckInResponse> {
  const { data } = await client.post<CheckInResponse>(ATTENDANCE.NO_SHOW(bookingId))
  return data
}

// Điểm danh nhanh (walk-in) theo SĐT
export async function quickCheckin(phone: string): Promise<QuickCheckinResponse> {
  const { data } = await client.post<QuickCheckinResponse>(ATTENDANCE.QUICK_CHECKIN, { phone })
  return data
}
