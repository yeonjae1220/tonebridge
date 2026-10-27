import { create } from 'zustand'

interface ErrorToastState {
  /** null 이면 기본 문구(error.unexpected)를 보여준다 — 문구 번역은 화면 쪽에서. */
  message: string | null
  visible: boolean
  show: (message: string | null) => void
  dismiss: () => void
}

export const useErrorToastStore = create<ErrorToastState>()((set) => ({
  message: null,
  visible: false,
  show: (message) => set({ message, visible: true }),
  dismiss: () => set({ visible: false }),
}))
