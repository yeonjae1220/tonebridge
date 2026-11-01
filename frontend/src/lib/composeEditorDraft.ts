import { useAuthStore } from '@/stores/authStore'
import { DraftStorageError } from './draftStorageError'

export type EditorValue = {
  kind: 'TEXT' | 'AUDIO'; destination: 'PERSONAL' | 'FRIEND' | 'COMMUNITY'
  selectedFriendId: string; targetLanguage: string; targetVariant: string | null
  contentText: string; context: string; selectedGoals: string[]; step: number; sourceCardId: string | null
}
type Row = { version: 1; owner: string; revision: string; revocation: string; updatedAt: number; value: EditorValue | null }
export type EditorHandle = { owner: string; generation: number; revocation: string; revision?: string }
const prefix = 'tonebridge-compose-editor:'
const ttl = 7 * 24 * 60 * 60_000
const owners = new Set<string>()
export function bindEditorOwner(owner: string) { owners.add(owner) }
const marker = (owner: string) => localStorage.getItem(`tonebridge-draft-revoked:${owner}`) ?? ''
const string = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
function valid(v: EditorValue) {
  return v && ['TEXT', 'AUDIO'].includes(v.kind) && ['PERSONAL', 'FRIEND', 'COMMUNITY'].includes(v.destination)
    && string(v.selectedFriendId, 100) && string(v.targetLanguage, 50) && (v.targetVariant === null || string(v.targetVariant, 100))
    && string(v.contentText, 10000) && string(v.context, 10000) && Array.isArray(v.selectedGoals)
    && v.selectedGoals.length <= 6 && v.selectedGoals.every(g => string(g, 50))
    && Number.isInteger(v.step) && v.step >= 0 && v.step <= 2 && (v.sourceCardId === null || string(v.sourceCardId, 100))
}
function read(owner: string): Row | undefined {
  const json = localStorage.getItem(prefix + owner)
  if (!json) return
  if (json.length > 150000) throw new DraftStorageError('corrupt')
  const row = JSON.parse(json) as Row
  if (!row || row.version !== 1 || row.owner !== owner || !string(row.revision, 100) || !Number.isFinite(row.updatedAt)
    || (row.value !== null && !valid(row.value))) throw new DraftStorageError('corrupt')
  if (row.revocation !== marker(owner) || Date.now() - row.updatedAt > ttl) return
  return row
}
export function openEditor(owner: string, replace = false): { handle: EditorHandle; value?: EditorValue } {
  owners.add(owner)
  let row: Row | undefined
  try { row = read(owner) } catch (e) { if (!replace) throw e }
  const value = row?.value
  const meaningful = value && (value.contentText || value.context || value.selectedFriendId || value.targetLanguage || value.targetVariant
    || value.selectedGoals.length || value.sourceCardId || value.kind !== 'TEXT' || value.destination !== 'PERSONAL' || value.step > 0)
  return { handle: { owner, generation: useAuthStore.getState().sessionGeneration, revocation: marker(owner), revision: row?.revision }, value: meaningful ? value : undefined }
}
function guard(handle: EditorHandle) {
  const auth = useAuthStore.getState()
  if (!auth.accessToken || auth.sessionGeneration !== handle.generation || marker(handle.owner) !== handle.revocation)
    throw new DraftStorageError('conflict')
}
// Web Locks serialize compare-and-write across tabs. A stale editor never silently
// replaces a newer draft, including a tombstone left by submission or discard.
export async function writeEditor(handle: EditorHandle, value: EditorValue | null, replace = false) {
  if (value && !valid(value)) throw new DraftStorageError('corrupt')
  return navigator.locks.request(prefix + handle.owner, () => {
    guard(handle)
    let previous: Row | undefined
    try { previous = read(handle.owner) } catch (e) { if (!replace) throw e }
    if (!replace && previous?.revision !== handle.revision) throw new DraftStorageError('conflict')
    if (previous && JSON.stringify(previous.value) === JSON.stringify(value)) return
    const revision = crypto.randomUUID()
    try {
      localStorage.setItem(prefix + handle.owner, JSON.stringify({ version: 1, owner: handle.owner, revision,
        revocation: handle.revocation, updatedAt: Date.now(), value } satisfies Row))
    } catch (error) {
      // A tombstone must not need additional quota after a successful submission.
      // Stale handles with the old revision also reject a missing row.
      if (value !== null) throw error
      localStorage.removeItem(prefix + handle.owner)
      handle.revision = undefined
      return
    }
    handle.revision = revision
  })
}

useAuthStore.subscribe((next, previous) => {
  if (next.sessionGeneration === previous.sessionGeneration) return
  for (const owner of owners) {
    try { localStorage.removeItem(prefix + owner) } catch { /* The recording revocation marker also invalidates this row. */ }
  }
  owners.clear()
})
