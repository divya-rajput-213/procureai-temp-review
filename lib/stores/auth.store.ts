import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/lib/api/auth'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setTokens: (access: string, refresh: string, user: User) => void
  logout: () => void
  isAuthenticated: () => boolean
  hasRole: (role: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setTokens: (access, refresh, user) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', access)
          localStorage.setItem('refresh_token', refresh)
        }
        set({ accessToken: access, refreshToken: refresh, user })
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
        set({ accessToken: null, refreshToken: null, user: null })
      },

      isAuthenticated: () => {
        return !!get().accessToken && !!get().user
      },

      hasRole: (roleName: string) => {
        const { user } = get()
        if (!user) return false
        return user.roles.some((r) => r.name === roleName)
      },
    }),
    {
      name: 'auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
