import client from './client'
import type {
  EquipmentResponse,
  CreateEquipmentRequest,
  UpdateEquipmentRequest,
  EquipmentCountByType,
} from '../types/equipment'

export const equipmentApi = {
  getAll: (includeInactive = false) =>
    client.get<EquipmentResponse[]>('/equipment', {
      params: { includeInactive },
    }),
  create: (data: CreateEquipmentRequest) =>
    client.post<EquipmentResponse>('/equipment', data),
  update: (id: number, data: UpdateEquipmentRequest) =>
    client.put<EquipmentResponse>(`/equipment/${id}`, data),
  deactivate: (id: number) =>
    client.patch<EquipmentResponse>(`/equipment/${id}/status`),
  countByType: () =>
    client.get<EquipmentCountByType[]>('/equipment/count-by-type'),
}
