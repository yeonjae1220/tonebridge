import { useAuthStore } from '@/stores/authStore'

export type RecordingDraft = { blob: Blob; duration: number }
const drafts = new Map<string, RecordingDraft>()
const active = new Set<string>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

// Voice drafts stay in this tab's memory, never localStorage or a shared cache.
// Logout/account replacement must also invalidate late recorder callbacks.
useAuthStore.subscribe((current, previous) => {
  if (current.sessionGeneration !== previous.sessionGeneration) {
    drafts.clear(); active.clear(); emit()
  }
})

export const recordingDrafts = {
  get: (key: string) => drafts.get(key),
  set(key: string, draft: RecordingDraft) { drafts.set(key, draft); active.delete(key); emit() },
  delete(key: string) { drafts.delete(key); active.delete(key); emit() },
  markActive(key: string) { active.add(key); emit() },
  hasUnsaved: () => drafts.size > 0 || active.size > 0,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
}
