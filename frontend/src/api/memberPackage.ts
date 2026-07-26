import client from './client'
import { MEMBERS, MEMBER_PACKAGES } from './endpoints'
import type { MemberResponse } from '../types'
import type {
  MemberPackageResponse,
  RegisterPackageRequest,
} from '../types/memberPackage'

/**
 * Tìm hội viên ACTIVE theo tên hoặc SĐT (UC3.2 — GET /members/search?q=).
 * Backend trả [] khi q rỗng.
 */
export async function searchMembers(query: string): Promise<MemberResponse[]> {
  const q = query.trim()
  if (!q) return []
  const { data } = await client.get<MemberResponse[]>(MEMBERS.SEARCH, {
    params: { q },
  })
  return data
}

/**
 * Đăng ký / gia hạn gói tập (UC3.2 — POST /member-packages).
 * Backend tự xác định NEW vs RENEWAL và ghi package_transaction.
 */
export async function registerPackage(
  req: RegisterPackageRequest
): Promise<MemberPackageResponse> {
  const { data } = await client.post<MemberPackageResponse>(
    MEMBER_PACKAGES.BASE,
    req
  )
  return data
}

/**
 * Danh sách tất cả gói của hội viên, mới nhất trước
 * (UC3.2 — GET /members/{id}/packages).
 */
export async function getMemberPackages(
  memberId: number
): Promise<MemberPackageResponse[]> {
  const { data } = await client.get<MemberPackageResponse[]>(
    MEMBERS.PACKAGES(memberId)
  )
  return data
}
