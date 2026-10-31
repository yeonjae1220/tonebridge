import { useAuthStore } from '@/stores/authStore'
import { recordingDrafts, type RecordingDraft } from '@/lib/recordingDrafts'

export type CompositionInput = {
  kind: 'TEXT' | 'AUDIO'; destination: 'PERSONAL' | 'FRIEND' | 'COMMUNITY'
  friendId: string | null; title: string; contentText: string; context: string
  audioTitle: string; targetLanguage: string; targetVariant: string | null; goals: string[]
}
export type CompositionDraft = {
  owner: string; operation: string; input: CompositionInput; uploaded: boolean
  createdAt: number; revocation: string; sourceRecordingId?: string
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
export async function createComposition(owner: string, input: CompositionInput, recording?: RecordingDraft): Promise<CompositionDraft> {
  // Another tab may already have an unresolved save. Resume it before starting
  // a new one instead of overwriting its identity.
  const generation = useAuthStore.getState().sessionGeneration
  return navigator.locks.request(prefix + owner, async () => {
    if (generation !== useAuthStore.getState().sessionGeneration) throw new Error('Account changed')
    const existing = loadComposition(owner)
    // Do not attach this tab's recording to another tab's immutable submission.
    if (existing) throw new PendingCompositionError('Another composition is pending; reopen to resume')
    const draft: CompositionDraft = { owner, input, operation: crypto.randomUUID(), uploaded: false, createdAt: Date.now(), revocation: revocation(owner),
      sourceRecordingId: recordingDrafts.info(`${generation}:compose`)?.id }
    try {
      if (input.kind === 'AUDIO') {
        if (!recording) throw new Error('No recording')
        const key = await audioKey(draft)
        recordingDrafts.set(key, recording)
        await recordingDrafts.settled()
        if (recordingDrafts.info(key)?.status !== 'saved') throw new Error('Audio snapshot not persisted')
      }
      if (generation !== useAuthStore.getState().sessionGeneration) throw new Error('Account changed')
      localStorage.setItem(prefix + owner, JSON.stringify(draft))
    } catch (error) { void discardAudio(draft); throw error }
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
  void discardAudio(draft)
}

async function audioKey(draft: CompositionDraft) {
  const generation = useAuthStore.getState().sessionGeneration
  if (!useAuthStore.getState().accessToken || activeOwner !== draft.owner || draft.revocation !== revocation(draft.owner)) throw new Error('Account changed')
  const scope = `compose-submit:${draft.operation}`, key = `${generation}:${scope}`
  await recordingDrafts.load(key, draft.owner, scope)
  if (generation !== useAuthStore.getState().sessionGeneration || activeOwner !== draft.owner || draft.revocation !== revocation(draft.owner)) throw new Error('Account changed')
  return key
}
export async function compositionFile(draft: CompositionDraft) {
  const key = await audioKey(draft)
  const blob = recordingDrafts.get(key)?.blob
  if (!blob) throw new Error('Submitted recording unavailable')
  return new File([blob], 'composition', { type: blob.type })
}
async function discardAudio(draft: CompositionDraft) {
  if (draft.input.kind !== 'AUDIO') return
  try { recordingDrafts.delete(await audioKey(draft)) } catch { /* Existing epoch/TTL cleanup also revokes this snapshot. */ }
}
export function isCompositionSource(draft: CompositionDraft) {
  return !!draft.sourceRecordingId && draft.sourceRecordingId === recordingDrafts.info(`${useAuthStore.getState().sessionGeneration}:compose`)?.id
}

useAuthStore.subscribe((next, previous) => {
  if (next.sessionGeneration === previous.sessionGeneration) return
  if (activeOwner) {
    try { localStorage.removeItem(prefix + activeOwner) } catch { /* Revocation marker also invalidates on reload. */ }
  }
  activeOwner = undefined
})
