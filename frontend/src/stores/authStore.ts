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

// This claim only invalidates client work when refresh cookies changed in another tab.
// Authorization and JWT signature verification remain exclusively on the server.
function tokenSubject(token: string | null): string | null {
  if (!token) return null
  try {
    const encoded = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    if (!encoded) return null
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')))
    return typeof payload?.sub === 'string' ? payload.sub : null
  } catch { return null }
}

export const useAuthStore = create<AuthState>()((set) => ({
  sessionGeneration: 0,
  accessToken: null,
  user: null,
  setAccessToken: (accessToken) => set((state) => {
    const changedOwner = !!state.accessToken && tokenSubject(state.accessToken) !== tokenSubject(accessToken)
    return { accessToken, sessionGeneration: state.sessionGeneration + (!state.accessToken || changedOwner ? 1 : 0),
      ...(changedOwner ? { user: null } : {}) }
  }),
  beginSession: (accessToken) => set((state) => ({ accessToken, user: null, sessionGeneration: state.sessionGeneration + 1 })),
  setUser: (user) => set({ user }),
  logout: () => set((state) => ({ accessToken: null, user: null, sessionGeneration: state.sessionGeneration + 1 })),
}))
