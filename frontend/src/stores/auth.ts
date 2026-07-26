import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '../types'

interface AuthState {
  token: string | null
  role: Role | null
  fullName: string | null
  email: string | null
  userId: number | null
  setAuth: (token: string, role: Role, fullName: string, email: string, userId: number) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      role: null,
      fullName: null,
      email: null,
      userId: null,
      setAuth: (token, role, fullName, email, userId) =>
        set({ token, role, fullName, email, userId }),
      clearAuth: () =>
        set({ token: null, role: null, fullName: null, email: null, userId: null }),
      isAuthenticated: () => !!get().token,
    }),
    { name: 'picore-auth' }
  )
)
