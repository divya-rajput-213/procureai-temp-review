import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/lib/api/auth'

interface CompanyInfo {
  id: number
  name: string
  schema_name: string
  logo?: string | null
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  company: CompanyInfo | null
  hasHydrated: boolean
  setHasHydrated: (value: boolean) => void
  setTokens: (access: string, refresh: string, user: User, company?: CompanyInfo | null) => void
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
      company: null,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      setTokens: (access, refresh, user, company) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', access)
          localStorage.setItem('refresh_token', refresh)
          document.cookie = 'auth_session=1; path=/; SameSite=Lax'
        }
        set({ accessToken: access, refreshToken: refresh, user, company: company ?? null })
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          document.cookie = 'auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        }
        set({ accessToken: null, refreshToken: null, user: null, company: null })
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
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        company: state.company,
      }),
    }
  )
)
