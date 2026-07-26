import client from './client'
import type {
  TrainerResponse,
  AvailableAccountResponse,
  CreateTrainerRequest,
  UpdateTrainerRequest,
  TrainerShiftsResponse,
} from '../types/trainer'
import type { AvailableTrainerResponse } from '../types/class'

export const trainersApi = {
  getAll: () => client.get<TrainerResponse[]>('/trainers'),
  getAvailableAccounts: () =>
    client.get<AvailableAccountResponse[]>('/trainers/available-accounts'),
  // HLV không có xung đột lịch cho khung giờ + ngày đã chọn (UC4.1)
  // days truyền dạng CSV "MON,WED"; id trả về = trainer_profile.id
  getAvailableForClass: (days: string[], startTime: string, endTime: string) =>
    client.get<AvailableTrainerResponse[]>('/trainers/available-for-class', {
      params: { days: days.join(','), startTime, endTime },
    }),
  create: (data: CreateTrainerRequest) =>
    client.post<TrainerResponse>('/trainers', data),
  update: (id: number, data: UpdateTrainerRequest) =>
    client.put<TrainerResponse>(`/trainers/${id}`, data),
  deactivate: (id: number) =>
    client.patch<TrainerResponse>(`/trainers/${id}/status`),
  // week optional: bỏ trống → backend dùng tuần hiện tại, trả về week đã chuẩn hoá
  getShifts: (id: number, week?: string) =>
    client.get<TrainerShiftsResponse>(`/trainers/${id}/shifts`, {
      params: week ? { week } : undefined,
    }),
}
