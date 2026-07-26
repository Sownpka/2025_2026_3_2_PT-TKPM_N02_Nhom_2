import client from './client'
import type { PackageTypeResponse } from '../types'

export interface CreatePackageTypePayload {
  name: string
  category: string
  sessions?: number | null
  durationDays: number
  price: number
  description?: string
}

export interface UpdatePackageTypePayload extends CreatePackageTypePayload {}

export const packageTypesApi = {
  getAll: () => client.get<PackageTypeResponse[]>('/package-types'),
  getActive: () => client.get<PackageTypeResponse[]>('/package-types/active'),
  create: (data: CreatePackageTypePayload) =>
    client.post<PackageTypeResponse>('/package-types', data),
  update: (id: number, data: UpdatePackageTypePayload) =>
    client.put<PackageTypeResponse>(`/package-types/${id}`, data),
  toggleStatus: (id: number) =>
    client.patch<PackageTypeResponse>(`/package-types/${id}/status`),
}
