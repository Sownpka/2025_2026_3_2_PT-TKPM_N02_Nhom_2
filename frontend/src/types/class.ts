import type { Status } from './index'
import type { DayOfWeek } from './trainer'

// ===== Response từ GET /api/classes =====
// startTime/endTime serialize dạng "08:00:00" — cắt HH:mm khi hiển thị
export interface GymClassResponse {
  id: number
  name: string
  equipmentType: string | null
  trainerId: number | null
  trainerName: string | null
  daysOfWeek: DayOfWeek[]
  startTime: string
  endTime: string
  capacity: number
  description: string | null
  status: Status
}

// ===== Request body cho POST/PUT =====
// startTime/endTime dạng "HH:mm" là đủ (backend parse được cả HH:mm:ss)
// daysOfWeek: ["MON","WED","FRI"]
export interface CreateClassRequest {
  name: string
  equipmentType: string
  trainerId: number
  daysOfWeek: DayOfWeek[]
  startTime: string
  endTime: string
  capacity: number
  description: string
}

export type UpdateClassRequest = CreateClassRequest

// ===== Thời khóa biểu — GET /api/timetable?week=YYYY-Www =====
export interface TimetableSession {
  sessionId: number
  gymClassId: number | null
  className: string
  trainerName: string
  sessionDate: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  capacity: number
  bookedCount: number
  availableSpots: number
  // UC5.1 — trạng thái đặt lịch của MEMBER đang đăng nhập cho buổi này.
  // null nếu không phải MEMBER hoặc chưa đặt; "BOOKED"/"ATTENDED"/"CANCELLED"/"NO_SHOW".
  myBookingStatus?: string | null
}

export interface TimetableResponse {
  week: string
  sessions: TimetableSession[]
}

// ===== HLV khả dụng — GET /api/trainers/available-for-class =====
// id = trainer_profile.id → dùng làm trainerId khi POST/PUT
export interface AvailableTrainerResponse {
  id: number
  fullName: string
}
