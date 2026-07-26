import client from './client'
import { CLASSES } from './endpoints'
import type {
  GymClassResponse,
  CreateClassRequest,
  UpdateClassRequest,
  TimetableResponse,
} from '../types/class'

export const classesApi = {
  getAll: () => client.get<GymClassResponse[]>(CLASSES.BASE),
  create: (data: CreateClassRequest) =>
    client.post<GymClassResponse>(CLASSES.BASE, data),
  update: (id: number, data: UpdateClassRequest) =>
    client.put<GymClassResponse>(CLASSES.BY_ID(id), data),
  deactivate: (id: number) =>
    client.patch<GymClassResponse>(`${CLASSES.BY_ID(id)}/status`),
  // week optional: bỏ trống → backend dùng tuần hiện tại, trả về week đã chuẩn hoá
  getTimetable: (week?: string) =>
    client.get<TimetableResponse>(CLASSES.TIMETABLE, {
      params: week ? { week } : undefined,
    }),
}
