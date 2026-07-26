import type { PackageCategory } from './index'

export type MemberPackageStatus = 'ACTIVE' | 'EXPIRED' | 'USED_UP'
export type TransactionType = 'NEW' | 'RENEWAL'

/**
 * Kết quả trả về khi đăng ký/gia hạn gói (POST) hoặc khi lấy danh sách gói
 * của hội viên (GET). Một số trường chỉ có ở POST (type, amountPaid) và bị
 * ẩn (null/undefined) ở GET list do backend dùng @JsonInclude(NON_NULL).
 */
export interface MemberPackageResponse {
  id: number
  memberId: number
  memberName: string
  packageTypeName: string
  packageCategory: PackageCategory
  startDate: string // ISO date YYYY-MM-DD
  endDate: string // ISO date YYYY-MM-DD
  sessionsRemaining: number | null // null = không giới hạn
  status: MemberPackageStatus
  type?: TransactionType | null // NEW/RENEWAL — chỉ có ở POST
  amountPaid?: number | null // chỉ có ở POST
  isPrivatePackage: boolean // true nếu GOI_1_1 hoặc GOI_1_2
  warningSessions: boolean // true nếu ≤ 2 buổi còn lại
  warningExpiry: boolean // true nếu ≤ 7 ngày hết hạn
}

export interface RegisterPackageRequest {
  memberId: number
  packageTypeId: number
  startDate?: string // ISO date; optional (chỉ dùng cho gói NEW, backend tự tính khi gia hạn)
}
