import type { Status } from './index'

export interface EquipmentResponse {
  id: number
  code: string
  name: string
  type: string
  location: string | null
  note: string | null
  status: Status
}

export interface CreateEquipmentRequest {
  code: string
  name: string
  type: string
  location?: string
  note?: string
}

// Sửa: không có code (code là bất biến sau khi tạo)
export interface UpdateEquipmentRequest {
  name: string
  type: string
  location?: string
  note?: string
}

export interface EquipmentCountByType {
  type: string
  count: number
}
