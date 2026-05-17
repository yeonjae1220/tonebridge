import { create } from 'zustand'
import type { User } from '@/types'

// accessToken은 메모리에만 보관 (localStorage 미사용 — XSS로 탈취 불가)
// 페이지 새로고침 시 복원은 providers.tsx의 tryRestoreSession()이 담당
interface AuthState {
  accessToken: string | null
  user: User | null
  setAccessToken: (token: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  logout: () => set({ accessToken: null, user: null }),
}))
