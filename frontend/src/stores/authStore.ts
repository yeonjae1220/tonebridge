import { create } from 'zustand'
import type { User } from '@/types'

// accessToken은 메모리에만 보관 (localStorage 미사용 — XSS 자체를 막는 것은 아님)
// 페이지 새로고침 시 복원은 providers.tsx의 tryRestoreSession()이 담당
interface AuthState {
  sessionGeneration: number
  accessToken: string | null
  user: User | null
  setAccessToken: (token: string) => void
  beginSession: (token: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  sessionGeneration: 0,
  accessToken: null,
  user: null,
  setAccessToken: (accessToken) => set((state) => ({
    accessToken, sessionGeneration: state.sessionGeneration + (state.accessToken ? 0 : 1),
  })),
  beginSession: (accessToken) => set((state) => ({ accessToken, user: null, sessionGeneration: state.sessionGeneration + 1 })),
  setUser: (user) => set({ user }),
  logout: () => set((state) => ({ accessToken: null, user: null, sessionGeneration: state.sessionGeneration + 1 })),
}))
