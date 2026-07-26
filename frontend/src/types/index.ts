export type Role = 'ADMIN' | 'RECEPTIONIST' | 'TRAINER' | 'MEMBER'
export type Status = 'ACTIVE' | 'INACTIVE'
export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

export interface ApiError {
  field?: string
  message: string
}

export interface LoginResponse {
  token: string
  role: Role
  fullName: string
  email: string
  userId: number
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

export interface AccountResponse {
  id: number
  fullName: string
  email: string
  phone: string | null
  role: Role
  status: Status
  createdAt: string
}

export type PackageCategory =
  | 'THEO_BUOI'
  | 'THEO_THANG'
  | 'KHONG_GIOI_HAN'
  | 'GOI_1_1'
  | 'GOI_1_2'

export interface PackageTypeResponse {
  id: number
  name: string
  category: PackageCategory
  sessions: number | null
  durationDays: number
  price: number
  description: string | null
  status: Status
}

export interface MemberResponse {
  id: number
  fullName: string
  phone: string
  email: string
  dob: string | null
  gender: Gender | null
  note: string | null
  status: Status
  createdAt: string
}

export interface ActivePackageInfo {
  id: number
  packageName: string
  sessionsRemaining: number
  startDate: string
  endDate: string
  status: string
}

export interface BookingHistoryItem {
  id: number
  className: string
  trainerName: string
  sessionDate: string
  status: string
}

export interface MemberDetailResponse {
  member: MemberResponse
  activePackages: ActivePackageInfo[]
  bookingHistory: BookingHistoryItem[]
}
