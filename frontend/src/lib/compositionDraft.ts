import { useAuthStore } from '@/stores/authStore'

export type CompositionInput = {
  kind: 'TEXT' | 'AUDIO'; destination: 'PERSONAL' | 'FRIEND' | 'COMMUNITY'
  friendId: string | null; title: string; contentText: string; context: string
  audioTitle: string; targetLanguage: string; targetVariant: string | null; goals: string[]
}
export type CompositionDraft = {
  owner: string; operation: string; input: CompositionInput; uploaded: boolean
  createdAt: number; revocation: string
}
const prefix = 'tonebridge-composition:'
export class PendingCompositionError extends Error {}
const revocation = (owner: string) => localStorage.getItem(`tonebridge-draft-revoked:${owner}`) ?? ''
let activeOwner: string | undefined

// A durable request identity is written BEFORE any network mutation. If browser
// storage is unavailable, do not risk an unrepeatable composition request.
export function loadComposition(owner: string): CompositionDraft | null {
  activeOwner = owner
  const json = localStorage.getItem(prefix + owner)
  if (!json) return null
  const draft = JSON.parse(json) as CompositionDraft
  if (draft.owner !== owner || draft.revocation !== revocation(owner)
      || draft.createdAt < Date.now() - 7 * 24 * 60 * 60_000) {
    localStorage.removeItem(prefix + owner)
    return null
  }
  return draft
}
export async function createComposition(owner: string, input: CompositionInput): Promise<CompositionDraft> {
  // Another tab may already have an unresolved save. Resume it before starting
  // a new one instead of overwriting its identity.
  const generation = useAuthStore.getState().sessionGeneration
  return navigator.locks.request(prefix + owner, () => {
    if (generation !== useAuthStore.getState().sessionGeneration) throw new Error('Account changed')
    const existing = loadComposition(owner)
    // Do not attach this tab's recording to another tab's immutable submission.
    if (existing) throw new PendingCompositionError('Another composition is pending; reopen to resume')
    const draft = { owner, input, operation: crypto.randomUUID(), uploaded: false, createdAt: Date.now(), revocation: revocation(owner) }
    localStorage.setItem(prefix + owner, JSON.stringify(draft))
    return draft
  })
}
export function markCompositionUploaded(draft: CompositionDraft) {
  const current = loadComposition(draft.owner)
  if (current?.operation !== draft.operation) throw new Error('Composition changed')
  localStorage.setItem(prefix + draft.owner, JSON.stringify({ ...current, uploaded: true }))
}
export function clearComposition(draft: CompositionDraft) {
  if (loadComposition(draft.owner)?.operation === draft.operation) localStorage.removeItem(prefix + draft.owner)
}

useAuthStore.subscribe((next, previous) => {
  if (next.sessionGeneration === previous.sessionGeneration) return
  if (activeOwner) {
    try { localStorage.removeItem(prefix + activeOwner) } catch { /* Revocation marker also invalidates on reload. */ }
  }
  activeOwner = undefined
})
