import { api } from './api'
import { useAuthStore } from '@/stores/authStore'
import { withRequestDeadline } from './requestDeadline'
import { getApiErrorStatus } from './apiError'
import { DraftStorageError } from './draftStorageError'
import { attachCloudDeletionBridge, bindCloudOwner, cacheCloudSettings, canonical, cloudBindings, cloudChanged, forgetCloudBinding, saveCloudBindings,
  type CloudBinding, type CloudKind, type CloudSettings, type CloudValue, type CloudWrite } from './cloudDraftLocal'

export type RemoteDraft = { id: string; kind: CloudKind; scope: string; version: number; state: 'ACTIVE' | 'DELETED' | 'EXPIRED' | 'SUBMITTED'; value: CloudValue | null;
  updatedAt: string; expiresAt: string | null; pendingOperation: string | null; pendingKind: string | null; pendingPayload: Record<string, unknown> | null }
export type CloudRevision = { version: number; value: CloudValue; createdAt: string; expiresAt: string }
type Applied = { id: string | null; version: number }
type Session = { owner: string; generation: number; controller: AbortController; settings: CloudSettings | null }
let session: Session | null = null
let automaticFlight: Promise<void> | null = null
const base = '/users/me/drafts'
function capture(owner: string) {
  const current = session
  if (!current || current.owner !== owner || current.generation !== useAuthStore.getState().sessionGeneration || !useAuthStore.getState().accessToken) throw new DraftStorageError('unavailable')
  return current
}
function guard(current: Session) { if (session !== current || current.controller.signal.aborted || current.generation !== useAuthStore.getState().sessionGeneration) throw new DraftStorageError('conflict') }
async function read<T>(current: Session, path: string, parent?: AbortSignal): Promise<T> {
  guard(current)
  const result = await withRequestDeadline(signal => api.get<T>(path, { signal }).then(r => r.data), 15000, parent ?? current.controller.signal)
  parent?.throwIfAborted(); guard(current); return result
}
async function write<T>(current: Session, method: 'post' | 'put', path: string, body: unknown, parent?: AbortSignal): Promise<T> {
  guard(current)
  const result = await withRequestDeadline(signal => api[method]<T>(path, body, { signal }).then(r => r.data), 30000, parent ?? current.controller.signal)
  parent?.throwIfAborted(); guard(current); return result
}
export function startCloudSession(owner: string, generation: number) {
  session?.controller.abort()
  const current: Session = { owner, generation, controller: new AbortController(), settings: null }
  session = current
  try { bindCloudOwner(owner) } catch { /* The manager shows corrupt/quota metadata without risking a write. */ }
  cloudChanged()
  return () => { current.controller.abort(); if (session === current) session = null }
}
export function cloudSessionReady(owner: string) { return !!session && session.owner === owner && session.generation === useAuthStore.getState().sessionGeneration }
export async function readCloudSettings(owner: string, parent?: AbortSignal) {
  const current = capture(owner), value = await read<CloudSettings>(current, base + '/settings', parent)
  if (!value || typeof value.enabled !== 'boolean' || !Number.isSafeInteger(value.version) || (value.epoch !== null && !/^[0-9a-f-]{36}$/i.test(value.epoch))) throw new DraftStorageError('unavailable')
  if (current.settings && current.settings.version > value.version) return current.settings
  current.settings = value; cacheCloudSettings(owner, value); return value
}
export async function setCloudSettings(owner: string, input: { operationId: string; expectedVersion: number; enabled: boolean; erase: boolean }) {
  const current = capture(owner)
  const value = await write<CloudSettings>(current, 'put', base + '/settings', input)
  if (current.settings && current.settings.version > value.version) return current.settings
  current.settings = value; cacheCloudSettings(owner, value); cloudChanged(); return value
}
export async function setCloudAudioSettings(owner: string, input: { operationId: string; expectedVersion: number; enabled: boolean }) {
  const current = capture(owner)
  const value = await write<CloudSettings>(current, 'put', base + '/settings/audio', input)
  if (current.settings && current.settings.version > value.version) return current.settings
  current.settings = value; cacheCloudSettings(owner, value); cloudChanged(); return value
}
export function captureCloudAccount(owner: string) {
  const current = capture(owner)
  return { signal: current.controller.signal, check: () => guard(current) }
}
export function listCloudDrafts(owner: string) { return read<RemoteDraft[]>(capture(owner), base) }
export function readCloudDraft(owner: string, id: string) { return read<RemoteDraft>(capture(owner), base + '/' + id) }
export function readCloudHistory(owner: string, id: string) { return read<CloudRevision[]>(capture(owner), `${base}/${id}/history`) }
export function restoreCloudRevision(owner: string, id: string, revision: number, input: { epoch: string; expectedVersion: number; operationId: string }) {
  return write<Applied>(capture(owner), 'post', `${base}/${id}/history/${revision}/restore`, input)
}
export function writeCloudCopy(owner: string, id: string, input: CloudWrite) { return write<Applied>(capture(owner), 'put', `${base}/${id}`, input) }
export function deleteRemoteDraft(owner: string, id: string, input: { epoch: string; expectedVersion: number; operationId: string }) { return write<Applied>(capture(owner), 'post', `${base}/${id}/delete`, input) }
export async function readCloudOperation(owner: string, operation: string) {
  try { return await read<Applied>(capture(owner), `${base}/operations/${operation}`) } catch (error) { if (getApiErrorStatus(error) === 404) return null; throw error }
}
function update(current: Session, scope: string, id: string, transform: (binding: CloudBinding) => CloudBinding) {
  guard(current); const rows = cloudBindings(current.owner)
  if (rows[scope]?.id !== id) throw new DraftStorageError('conflict')
  rows[scope] = transform(rows[scope]); saveCloudBindings(current.owner, rows); return rows[scope]
}
async function resolveWrite(current: Session, scope: string, binding: CloudBinding, parent?: AbortSignal) {
  if (!binding.request) return binding
  const request = binding.request
  let applied: Applied | null = null
  try { applied = await read<Applied>(current, `${base}/operations/${request.operationId}`, parent) }
  catch (error) { if (getApiErrorStatus(error) !== 404) throw error }
  if (!applied) {
    if (!current.settings?.enabled || current.settings.epoch !== binding.epoch) throw new DraftStorageError('conflict')
    applied = await write<Applied>(current, 'put', base + '/' + binding.id, request, parent)
  }
  if (applied.id !== binding.id) throw new DraftStorageError('conflict')
  return update(current, scope, binding.id, row => {
    if (row.request?.operationId !== request.operationId) throw new DraftStorageError('conflict')
    return { ...row, version: applied!.version, synced: canonical(request.value), request: null,
      dirty: canonical(row.value) !== canonical(request.value), error: null }
  })
}
async function locked<T>(current: Session, scope: string, action: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  return withRequestDeadline(signal => navigator.locks.request('tonebridge-cloud:' + current.owner + ':' + scope, { signal }, async () => {
    signal.throwIfAborted(); guard(current); return action(signal)
  }), 30000, parent ?? current.controller.signal)
}
export async function synchronizeCloudDraft(owner: string, scope: string, force = false, parent?: AbortSignal) {
  const current = capture(owner)
  return locked(current, scope, async signal => {
    let binding = cloudBindings(owner)[scope]
    if (binding?.kind === 'recording' && !binding.audio?.ready) return
    if (!binding || (!force && (binding.error || binding.pendingLocal))) return
    try {
      if (!current.settings) await readCloudSettings(owner, signal)
      if (binding.epoch !== current.settings?.epoch) throw new DraftStorageError('conflict')
      binding = await resolveWrite(current, scope, binding, signal)
      if (binding.version > 0) {
        const remote = await read<RemoteDraft>(current, base + '/' + binding.id, signal)
        if (remote.state !== 'ACTIVE' || remote.pendingOperation) throw new DraftStorageError('conflict')
        if (remote.version !== binding.version) {
          if (canonical(remote.value) !== binding.synced) throw new DraftStorageError('conflict')
          binding = update(current, scope, binding.id, row => ({ ...row, version: remote.version, error: null }))
        }
      }
      binding = cloudBindings(owner)[scope]
      if (!binding?.dirty || !current.settings?.enabled || (binding.kind === 'recording' && !current.settings.audioEnabled)) return
      if (!binding.request) binding = update(current, scope, binding.id, row => ({ ...row, request: {
        operationId: crypto.randomUUID(), epoch: row.epoch, expectedVersion: row.version, kind: row.kind, scope, value: row.value, editedAt: row.updatedAt,
      } }))
      await resolveWrite(current, scope, binding, signal)
    } catch (error) {
      if (session === current && current.generation === useAuthStore.getState().sessionGeneration) {
        const code = getApiErrorStatus(error)
        try { update(current, scope, binding.id, row => ({ ...row, error: code === 409 || code === 404 || error instanceof DraftStorageError ? 'conflict' : code === 429 ? 'rate' : code === 400 || code === 413 ? 'limit' : 'network',
          request: code === 400 || code === 409 || code === 413 ? null : row.request })) } catch { /* Keep local text if metadata itself cannot be written. */ }
      }
      throw error
    }
  }, parent)
}
export async function synchronizeAllCloudDrafts(owner: string, retry = false) {
  if (automaticFlight) return automaticFlight
  const current = capture(owner)
  const flight = (async () => {
    try { await readCloudSettings(owner) } catch (error) {
      guard(current)
      for (const row of Object.values(cloudBindings(owner))) if ((row.dirty || row.request) && !row.error) update(current, row.scope, row.id, currentRow => ({ ...currentRow, error: 'network' }))
      throw error
    }
    for (const row of Object.values(cloudBindings(owner))) {
      guard(current)
      if (row.pendingLocal || (row.error && (!retry || !['network', 'rate'].includes(row.error)))) continue
      try { await synchronizeCloudDraft(owner, row.scope, retry) } catch { guard(current) }
    }
  })()
  automaticFlight = flight
  try { await flight } finally { if (automaticFlight === flight) automaticFlight = null }
}
/** Called only by an explicit save action, after its durable local operation exists. */
export async function prepareCloudSubmission(owner: string, scope: string, operation: string, kind: 'COMPOSITION' | 'SUBMISSION', payload: Record<string, unknown>, parent?: AbortSignal, receiptChecked = false): Promise<Record<string, unknown> | null> {
  let binding = cloudBindings(owner)[scope]
  if (!binding) return null
  const current = capture(owner)
  const receiptPath = kind === 'COMPOSITION' ? '/compositions/' : '/submissions/'
  if (!receiptChecked) {
    try { return await read<Record<string, unknown>>(current, receiptPath + operation, parent) }
    catch (error) { if (getApiErrorStatus(error) !== 404) throw error }
  }
  await readCloudSettings(owner, parent)
  if (!current.settings?.enabled && binding.version === 0) {
    const accepted = binding.request ? await readCloudOperation(owner, binding.request.operationId) : null
    if (!accepted) {
      try { await read<RemoteDraft>(current, base + '/' + binding.id, parent) }
      catch (error) { if (getApiErrorStatus(error) === 404) { forgetCloudBinding(owner, scope, binding.id); return null }; throw error }
    }
  }
  // An already accepted preparation is resumed by the same identity even after a lost response.
  if (binding.version > 0) {
    const remote = await read<RemoteDraft>(current, base + '/' + binding.id, parent)
    if (remote.pendingOperation === operation && remote.pendingKind === kind) {
      update(current, scope, binding.id, row => ({ ...row, version: remote.version, submissionOperation: operation, pendingLocal: true, error: null }))
      return null
    }
  }
  await synchronizeCloudDraft(owner, scope, true, parent)
  binding = cloudBindings(owner)[scope]
  update(current, scope, binding.id, row => ({ ...row, submissionOperation: operation, pendingLocal: true }))
  const transportPayload = current.settings?.enabled && (payload.kind !== 'AUDIO' || binding.kind === 'recording') ? payload : null
  const prepared = await write<RemoteDraft>(current, 'post', `${base}/${binding.id}/prepare-submission`, {
    epoch: binding.epoch, expectedVersion: binding.version, operation, kind, payload: transportPayload,
  }, parent)
  update(current, scope, binding.id, row => ({ ...row, version: prepared.version, submissionOperation: operation, pendingLocal: true, error: null }))
  if (prepared.state === 'SUBMITTED') return read<Record<string, unknown>>(current, receiptPath + operation, parent)
  return null
}
attachCloudDeletionBridge(async (owner, scope, revision) => {
  const current = capture(owner)
  await locked(current, scope, async signal => {
    let row = cloudBindings(owner)[scope]
    if (!row || row.localRevision !== revision) throw new DraftStorageError('conflict')
    await readCloudSettings(owner, signal)
    if (row.request) row = await resolveWrite(current, scope, row, signal)
    let remote: RemoteDraft
    try { remote = await read<RemoteDraft>(current, base + '/' + row.id, signal) }
    catch (error) {
      if (getApiErrorStatus(error) === 404 && row.version === 0) { forgetCloudBinding(owner, scope, row.id); return }
      throw error
    }
    if (remote.state === 'ACTIVE') {
      if (remote.version !== row.version || remote.pendingOperation) throw new DraftStorageError('conflict')
      // Persist this mutation identity before issuing it; a timeout can be resolved by GET.
      const operationKey = 'tonebridge-cloud-delete:' + owner + ':' + row.id
      let operation = sessionStorage.getItem(operationKey)
      if (!operation) { operation = crypto.randomUUID(); sessionStorage.setItem(operationKey, operation) }
      await write<Applied>(current, 'post', `${base}/${row.id}/delete`, { epoch: row.epoch, expectedVersion: row.version, operationId: operation }, signal)
      sessionStorage.removeItem(operationKey)
    }
    guard(current); forgetCloudBinding(owner, scope, row.id)
  })
})
useAuthStore.subscribe((next, previous) => {
  if (next.sessionGeneration !== previous.sessionGeneration) { session?.controller.abort(); session = null; automaticFlight = null }
})
