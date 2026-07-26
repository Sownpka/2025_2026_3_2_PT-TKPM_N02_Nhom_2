import { create } from 'zustand'
import type { MemberResponse, PackageTypeResponse } from '../types'
import type {
  MemberPackageResponse,
  RegisterPackageRequest,
} from '../types/memberPackage'
import {
  searchMembers as apiSearchMembers,
  getMemberPackages as apiGetMemberPackages,
  registerPackage as apiRegisterPackage,
} from '../api/memberPackage'
import { packageTypesApi } from '../api/packageTypes'

interface MemberPackageState {
  // Tìm kiếm hội viên
  searchResults: MemberResponse[]
  searching: boolean
  searched: boolean // đã bấm "Tìm" ít nhất 1 lần (để phân biệt với trạng thái ban đầu)

  // Hội viên đang chọn + các gói của họ
  selectedMember: MemberResponse | null
  memberPackages: MemberPackageResponse[]
  loadingPackages: boolean

  // Danh sách loại gói ACTIVE (dropdown)
  packageTypes: PackageTypeResponse[]
  loadingPackageTypes: boolean

  // Actions
  searchMembers: (query: string) => Promise<void>
  selectMember: (member: MemberResponse) => Promise<void>
  clearSelection: () => void
  loadPackageTypes: () => Promise<void>
  refreshSelectedPackages: () => Promise<void>
  register: (req: RegisterPackageRequest) => Promise<MemberPackageResponse>
  reset: () => void
}

export const useMemberPackageStore = create<MemberPackageState>((set, get) => ({
  searchResults: [],
  searching: false,
  searched: false,

  selectedMember: null,
  memberPackages: [],
  loadingPackages: false,

  packageTypes: [],
  loadingPackageTypes: false,

  searchMembers: async (query) => {
    set({ searching: true })
    try {
      const results = await apiSearchMembers(query)
      set({ searchResults: results, searched: true })
    } catch (err) {
      set({ searchResults: [], searched: true })
      throw err
    } finally {
      set({ searching: false })
    }
  },

  selectMember: async (member) => {
    set({
      selectedMember: member,
      searchResults: [],
      memberPackages: [],
      loadingPackages: true,
    })
    try {
      const packages = await apiGetMemberPackages(member.id)
      set({ memberPackages: packages })
    } catch {
      set({ memberPackages: [] })
    } finally {
      set({ loadingPackages: false })
    }
  },

  clearSelection: () => {
    set({ selectedMember: null, memberPackages: [] })
  },

  loadPackageTypes: async () => {
    set({ loadingPackageTypes: true })
    try {
      const { data } = await packageTypesApi.getActive()
      // Chỉ hiện gói ACTIVE (phòng khi endpoint trả cả gói ngừng áp dụng)
      set({ packageTypes: data.filter((p) => p.status === 'ACTIVE') })
    } catch {
      set({ packageTypes: [] })
    } finally {
      set({ loadingPackageTypes: false })
    }
  },

  refreshSelectedPackages: async () => {
    const member = get().selectedMember
    if (!member) return
    set({ loadingPackages: true })
    try {
      const packages = await apiGetMemberPackages(member.id)
      set({ memberPackages: packages })
    } catch {
      /* giữ nguyên danh sách cũ nếu lỗi */
    } finally {
      set({ loadingPackages: false })
    }
  },

  register: async (req) => {
    const result = await apiRegisterPackage(req)
    // Làm mới danh sách gói của hội viên để card cập nhật gói mới
    await get().refreshSelectedPackages()
    return result
  },

  reset: () =>
    set({
      searchResults: [],
      searching: false,
      searched: false,
      selectedMember: null,
      memberPackages: [],
      loadingPackages: false,
    }),
}))
