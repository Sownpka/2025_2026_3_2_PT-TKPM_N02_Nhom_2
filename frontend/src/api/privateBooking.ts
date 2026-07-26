import client from './client'
import { PRIVATE_BOOKING } from './endpoints'
import type { BookingResponse } from './bookings'
import type { DayOfWeek } from '../types/trainer'

// Một khung giờ trống của HLV trong tuần kế tiếp
export interface SlotEntry {
  trainerId: number
  trainerName: string
  date: string // "yyyy-MM-dd"
  dayOfWeek: DayOfWeek // "MON" | ... | "SUN"
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  available: boolean
}

export interface PrivateSlotsResponse {
  targetWeek: string // "2026-W31"
  deadlinePassed: boolean
  slots: SlotEntry[]
}

export interface CreatePrivateBookingRequest {
  trainerId: number
  date: string // "yyyy-MM-dd"
  startTime: string // "HH:mm"
  memberPackageId: number
  partnerMemberId?: number | null // gói 1-2: mời cụ thể (backend resolve id)
  joinMatchmaking?: boolean // gói 1-2: nhờ hệ thống ghép
}

// GET /private-booking/slots?week=YYYY-Www (week optional)
export async function fetchPrivateSlots(week?: string): Promise<PrivateSlotsResponse> {
  const { data } = await client.get<PrivateSlotsResponse>(PRIVATE_BOOKING.SLOTS, {
    params: week ? { week } : undefined,
  })
  return data
}

// POST /private-booking
export async function createPrivateBooking(
  req: CreatePrivateBookingRequest
): Promise<BookingResponse> {
  const { data } = await client.post<BookingResponse>(PRIVATE_BOOKING.BASE, req)
  return data
}
