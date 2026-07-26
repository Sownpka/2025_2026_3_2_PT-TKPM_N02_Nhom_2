import client from './client'
import { NOTIFICATIONS } from './endpoints'

// ===== Kênh / Loại / Trạng thái thông báo =====
export type NotificationChannel = 'EMAIL' | 'SMS'
export type NotificationType =
  | 'CONFIRM'
  | 'REMINDER'
  | 'WAITLIST_INVITE'
  | 'ACTIVATION'
export type NotificationStatus = 'SENT' | 'FAILED'

// ===== Một dòng trong lịch sử thông báo =====
export interface NotificationLogItem {
  id: number
  memberName: string | null
  channel: NotificationChannel
  type: NotificationType
  content: string
  status: NotificationStatus
  retryCount: number
  sentAt: string | null // ISO datetime string
}

// ===== Page<NotificationLogItem> (chuẩn Spring) =====
export interface NotificationPage {
  content: NotificationLogItem[]
  totalElements: number
  totalPages: number
  number: number // trang hiện tại (0-based)
}

export interface NotificationQuery {
  type?: string
  status?: string
  page?: number
  size?: number
}

// GET /api/notifications — ADMIN only. Bỏ qua param nếu empty/undefined.
export async function fetchNotifications(
  params: NotificationQuery
): Promise<NotificationPage> {
  const query: Record<string, string | number> = {}
  if (params.type) query.type = params.type
  if (params.status) query.status = params.status
  if (params.page !== undefined) query.page = params.page
  if (params.size !== undefined) query.size = params.size

  const { data } = await client.get<NotificationPage>(NOTIFICATIONS.BASE, {
    params: query,
  })
  return data
}
