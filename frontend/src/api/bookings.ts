import client from './client'
import { BOOKINGS, CLASSES, ME } from './endpoints'
import type { TimetableResponse } from '../types/class'

// ===== Trạng thái đặt lịch =====
export type MyBookingStatus = 'BOOKED' | 'ATTENDED' | 'CANCELLED' | 'NO_SHOW'
// Tab lịch của tôi → tham số ?status gửi lên backend
export type MyBookingFilter = 'UPCOMING' | 'COMPLETED' | 'CANCELLED'

// ===== GET /me/bookings?status=... =====
export interface MyBookingItem {
  bookingId: number
  className: string
  trainerName: string
  sessionDate: string // "yyyy-MM-dd"
  startTime: string // "HH:mm:ss"
  endTime: string // "HH:mm:ss"
  bookingStatus: MyBookingStatus
  bookedAt: string
  cancelledAt: string | null
}

// ===== POST /bookings =====
export interface CreateBookingRequest {
  classSessionId: number
  memberPackageId: number
}

export interface BookingResponse {
  id: number
  classSessionId: number
  status: string
  bookedAt: string
}

// Thời khóa biểu (dùng chung endpoint /timetable — MEMBER nhận thêm myBookingStatus).
// week bỏ trống → backend dùng tuần hiện tại và trả về week đã chuẩn hóa.
export async function fetchTimetable(week?: string): Promise<TimetableResponse> {
  const { data } = await client.get<TimetableResponse>(CLASSES.TIMETABLE, {
    params: week ? { week } : undefined,
  })
  return data
}

export async function createBooking(
  payload: CreateBookingRequest
): Promise<BookingResponse> {
  const { data } = await client.post<BookingResponse>(BOOKINGS.BASE, payload)
  return data
}

export async function cancelBooking(bookingId: number): Promise<void> {
  await client.delete(BOOKINGS.BY_ID(bookingId))
}

export async function joinWaitlist(classSessionId: number): Promise<void> {
  await client.post(BOOKINGS.WAITLIST, { classSessionId })
}

export async function fetchMyBookings(
  status: MyBookingFilter
): Promise<MyBookingItem[]> {
  const { data } = await client.get<MyBookingItem[]>(ME.BOOKINGS, {
    params: { status },
  })
  return data
}
