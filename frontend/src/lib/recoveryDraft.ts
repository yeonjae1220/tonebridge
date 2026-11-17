import { useAuthStore } from '@/stores/authStore'
import { DraftStorageError } from './draftStorageError'
import { withDraftLock } from './draftLock'
import { observeCloudDraft, beforeCloudLocalDelete } from './cloudDraftLocal'
import { validFeedback, validCardDraft } from './feedbackDraft'

export type PendingSubmission = { operation: string; payload: Record<string, unknown>; recordingId?: string }
export type RecoveryValue = { kind: 'feedback' | 'card' } & Record<string, unknown>
export type RecoveryRow = { version: 1; owner: string; scope: string; revision: string; revocation: string; updatedAt: number; value: RecoveryValue | null; pending: PendingSubmission | null }
export type RecoveryHandle = { owner: string; scope: string; generation: number; revocation: string; revision?: string }
const prefix = 'tonebridge-recovery:'
const ttl = 7 * 24 * 60 * 60_000
const owners = new Set<string>()
export function bindRecoveryOwner(owner: string) { owners.add(owner) }
const marker = (owner: string) => localStorage.getItem(`tonebridge-draft-revoked:${owner}`) ?? ''
const key = (owner: string, scope: string) => prefix + owner + ':' + scope
function read(owner: string, scope: string): RecoveryRow | undefined {
  const raw = localStorage.getItem(key(owner, scope))
  if (!raw) return
  if (raw.length > 300000) throw new DraftStorageError('corrupt')
  const row = JSON.parse(raw) as RecoveryRow
  if (!row || row.version !== 1 || row.owner !== owner || row.scope !== scope || typeof row.revision !== 'string'
    || !Number.isFinite(row.updatedAt) || !Number.isFinite(new Date(row.updatedAt).getTime())
    || (row.value !== null && !validFeedback(row.value) && !validCardDraft(row.value))
    || (row.pending !== null && (!row.value || !row.pending || !/^[0-9a-f-]{36}$/.test(row.pending.operation)
      || !row.pending.payload || typeof row.pending.payload !== 'object' || Array.isArray(row.pending.payload)))) throw new DraftStorageError('corrupt')
  if (row.revocation !== marker(owner) || Date.now() - row.updatedAt > ttl) { localStorage.removeItem(key(owner, scope)); return }
  return row
}
export function openRecovery(owner: string, scope: string) {
  owners.add(owner)
  const row = read(owner, scope)
  return { handle: { owner, scope, generation: useAuthStore.getState().sessionGeneration, revocation: marker(owner), revision: row?.revision } satisfies RecoveryHandle, row }
}
function guard(handle: RecoveryHandle) {
  const auth = useAuthStore.getState()
  if (!auth.accessToken || auth.sessionGeneration !== handle.generation || marker(handle.owner) !== handle.revocation)
    throw new DraftStorageError('conflict')
}
export async function writeRecovery(handle: RecoveryHandle, value: RecoveryValue | null, pending: PendingSubmission | null, signal?: AbortSignal) {
  guard(handle)
  if (value === null) await beforeCloudLocalDelete(handle.owner, handle.scope, handle.revision)
  signal?.throwIfAborted()
  return withDraftLock(key(handle.owner, handle.scope), () => {
    guard(handle)
    const row = read(handle.owner, handle.scope)
    if (row?.revision !== handle.revision) throw new DraftStorageError('conflict')
    const revision = crypto.randomUUID()
    const next: RecoveryRow = { version: 1, owner: handle.owner, scope: handle.scope, revocation: handle.revocation, revision, updatedAt: Date.now(), value, pending }
    const raw = JSON.stringify(next)
    if (raw.length > 300000) throw new DraftStorageError('quota')
    localStorage.setItem(key(handle.owner, handle.scope), raw)
    handle.revision = revision
    if (value) observeCloudDraft(handle.owner, handle.scope, value.kind, value, revision, !row?.value, !!pending)
  }, signal)
}
export function recoverySnapshots(owner: string, onError: () => void) {
  owners.add(owner)
  const rows: { handle: RecoveryHandle; row: RecoveryRow }[] = []
  const start = prefix + owner + ':'
  for (const name of Object.keys(localStorage).filter(name => name.startsWith(start))) {
    let opened: ReturnType<typeof openRecovery>
    try { opened = openRecovery(owner, name.slice(start.length)) }
    catch { onError(); continue } // Preserve healthy drafts, while the caller displays a partial-read error.
    guard(opened.handle)
    if (opened.row?.value) rows.push({ handle: opened.handle, row: opened.row })
  }
  return rows.sort((a, b) => b.row.updatedAt - a.row.updatedAt)
}
useAuthStore.subscribe((next, previous) => {
  if (next.sessionGeneration === previous.sessionGeneration) return
  for (const owner of owners) {
    try { for (const name of Object.keys(localStorage)) if (name.startsWith(prefix + owner + ':')) localStorage.removeItem(name) }
    catch { /* Existing revocation markers also invalidate local drafts. */ }
  }
  owners.clear()
})
