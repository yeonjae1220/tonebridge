import { useAuthStore } from '@/stores/authStore'
import { DraftStorageError } from './draftStorageError'

export type CloudKind = 'editor' | 'feedback' | 'card' | 'recording'
export type CloudSettings = { enabled: boolean; epoch: string | null; version: number; audioEnabled?: boolean }
export type CloudValue = Record<string, unknown>
export type CloudWrite = { operationId: string; epoch: string; expectedVersion: number; kind: CloudKind; scope: string; value: CloudValue; editedAt: number }
export type CloudBinding = { id: string; epoch: string; version: number; kind: CloudKind; scope: string; value: CloudValue;
  localRevision: string; updatedAt: number; synced: string | null; dirty: boolean; pendingLocal: boolean;
  audio?: { sourceId: string; sourceUpdatedAt: number; assetId: string; sha256: string; byteSize: number; contentType: string; ready: boolean }; request: CloudWrite | null; submissionOperation?: string; error: 'conflict' | 'network' | 'limit' | 'storage' | 'expired' | 'rate' | null }
const prefix = 'tonebridge-cloud-bindings:'
const preferencesPrefix = 'tonebridge-cloud-preferences:'
const eventName = 'tonebridge-cloud-change'
const owners = new Set<string>()
let deleteBridge: ((owner: string, scope: string, revision?: string) => Promise<void>) | null = null
let metadataError = false
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}'
  return JSON.stringify(value) ?? 'null'
}
export function cloudBindings(owner: string): Record<string, CloudBinding> {
  const raw = localStorage.getItem(prefix + owner)
  if (!raw) return {}
  if (raw.length > 4_000_000) throw new DraftStorageError('corrupt')
  const value = JSON.parse(raw) as Record<string, CloudBinding>
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length > 50) throw new DraftStorageError('corrupt')
  for (const [scope, row] of Object.entries(value)) {
    if (!row || row.scope !== scope || !/^[0-9a-f-]{36}$/i.test(row.id) || !/^[0-9a-f-]{36}$/i.test(row.epoch)
      || !Number.isSafeInteger(row.version) || row.version < 0 || !['editor', 'feedback', 'card', 'recording'].includes(row.kind)
      || !row.value || typeof row.value !== 'object' || typeof row.localRevision !== 'string' || !Number.isFinite(row.updatedAt)) throw new DraftStorageError('corrupt')
  }
  return value
}
export function saveCloudBindings(owner: string, rows: Record<string, CloudBinding>) {
  owners.add(owner)
  if (Object.keys(rows).length > 50) throw new DraftStorageError('quota')
  const raw = JSON.stringify(rows)
  if (raw.length > 4_000_000) throw new DraftStorageError('quota')
  localStorage.setItem(prefix + owner, raw)
  metadataError = false
  cloudChanged()
}
export function cloudChanged() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(eventName)) }
export function onCloudChange(listener: () => void) { window.addEventListener(eventName, listener); return () => window.removeEventListener(eventName, listener) }
export function cloudMetadataFailed() { return metadataError }
export function cachedCloudSettings(owner: string): CloudSettings | null {
  try {
    const value = JSON.parse(localStorage.getItem(preferencesPrefix + owner) ?? 'null') as CloudSettings | null
    return value && typeof value.enabled === 'boolean' && Number.isSafeInteger(value.version) && (value.epoch === null || /^[0-9a-f-]{36}$/i.test(value.epoch)) ? value : null
  } catch { return null }
}
export function cacheCloudSettings(owner: string, settings: CloudSettings) {
  owners.add(owner)
  try { localStorage.setItem(preferencesPrefix + owner, JSON.stringify(settings)) } catch { /* Queuing still needs durable binding storage before any write. */ }
}
export function expireLocalCloudValues(owner: string) {
  const rows = cloudBindings(owner); let changed = false
  for (const [scope, row] of Object.entries(rows)) if (Date.now() - row.updatedAt > 7 * 86400000 && (Object.keys(row.value).length || row.request)) {
    rows[scope] = { ...row, value: {}, request: null, synced: null, dirty: false, error: 'expired' }; changed = true
  }
  if (changed) saveCloudBindings(owner, rows)
}
export function bindCloudOwner(owner: string) {
  owners.add(owner)
  for (const key of Object.keys(sessionStorage)) if ((key.startsWith('tonebridge-cloud-manager:') && key !== 'tonebridge-cloud-manager:' + owner) || (key.startsWith('tonebridge-cloud-settings-operation:') && key !== 'tonebridge-cloud-settings-operation:' + owner)) sessionStorage.removeItem(key)
  // Only /users/me selects the authenticated owner. Other accounts never replay this queue.
  for (const name of Object.keys(localStorage)) if ((name.startsWith(prefix) && name !== prefix + owner) || (name.startsWith(preferencesPrefix) && name !== preferencesPrefix + owner)) localStorage.removeItem(name)
}
export function selectCloudDraft(owner: string, scope: string, kind: CloudKind, value: CloudValue, revision: string, settings: CloudSettings, updatedAt = Date.now()) {
  if (!settings.enabled || !settings.epoch) throw new DraftStorageError('unavailable')
  const rows = cloudBindings(owner)
  if (rows[scope]) throw new DraftStorageError('conflict')
  rows[scope] = { id: crypto.randomUUID(), epoch: settings.epoch, version: 0, kind, scope, value, localRevision: revision,
    updatedAt, synced: null, dirty: true, pendingLocal: false, request: null, error: null }
  saveCloudBindings(owner, rows)
}
export function observeCloudDraft(owner: string, scope: string, kind: CloudKind, value: CloudValue | null, revision: string, isNew: boolean, pending = false) {
  if (value && (kind === 'feedback' || kind === 'editor' && value.kind === 'AUDIO')) {
    try {
      const rows = cloudBindings(owner), audioScope = kind === 'editor' ? 'audio:compose' : 'audio:correction-reference:' + scope.split(':')[1], audio = rows[audioScope]
      if (audio && !audio.pendingLocal) {
        const next = { ...audio.value, [kind === 'editor' ? 'editor' : 'feedback']: value }
        if (canonical(next) !== canonical(audio.value)) { rows[audioScope] = { ...audio, value: next, updatedAt: Date.now(), dirty: canonical(next) !== audio.synced }; saveCloudBindings(owner, rows) }
      }
    } catch { metadataError = true; cloudChanged() }
  }
  if (!value || (kind === 'editor' && value.kind !== 'TEXT')) return
  try {
    const settings = cachedCloudSettings(owner)
    const rows = cloudBindings(owner)
    let row = rows[scope]
    if (!row) {
      if (!isNew || !settings?.enabled || !settings.epoch) return // Existing drafts need explicit selection.
      selectCloudDraft(owner, scope, kind, value, revision, settings)
      row = cloudBindings(owner)[scope]
      if (!pending) return
    }
    rows[scope] = { ...row, value, localRevision: revision, updatedAt: Date.now(), pendingLocal: pending, dirty: canonical(value) !== row.synced,
      error: row.error === 'expired' ? 'conflict' : row.error }
    saveCloudBindings(owner, rows)
  } catch { metadataError = true; cloudChanged() } // Local text has already been saved independently.
}
export function attachCloudDeletionBridge(bridge: typeof deleteBridge) { deleteBridge = bridge }
export async function beforeCloudLocalDelete(owner: string, scope: string, revision?: string) {
  const binding = cloudBindings(owner)[scope]
  if (!binding) return
  if ((scope === 'compose' || scope === 'audio:compose') && localStorage.getItem('tonebridge-composition:' + owner)) return // Durable pending composition is retired with its server receipt.
  if (binding.kind === 'recording' && binding.localRevision !== revision) return // A newer local recording does not delete the older linked cloud draft.
  if (binding.localRevision !== revision) throw new DraftStorageError('conflict')
  if (!deleteBridge) throw new DraftStorageError('unavailable')
  await deleteBridge(owner, scope, revision)
}
export function forgetCloudBinding(owner: string, scope: string, id: string) {
  const rows = cloudBindings(owner)
  if (rows[scope]?.id === id) { delete rows[scope]; saveCloudBindings(owner, rows) }
}
export function eraseLocalCloudMetadata(owner: string) {
  localStorage.removeItem(prefix + owner); localStorage.removeItem(preferencesPrefix + owner); cloudChanged()
}
useAuthStore.subscribe((next, previous) => {
  if (next.sessionGeneration === previous.sessionGeneration) return
  // A definitive session expiry pauses the queue; an explicit logout erases local data.
  const explicit = typeof document !== 'undefined' && document.cookie.split(';').some(c => c.trim() === 'tonebridge_signed_out=1')
  if (explicit) {
    try { for (const key of Object.keys(localStorage)) if (key.startsWith(prefix) || key.startsWith(preferencesPrefix)) localStorage.removeItem(key) } catch { /* Never send when local consent cannot be read. */ }
    try { for (const key of Object.keys(sessionStorage)) if (key.startsWith('tonebridge-cloud-')) sessionStorage.removeItem(key) } catch { /* No late completion is applied after logout. */ }
    owners.clear()
  }
  cloudChanged()
})

export function finishCloudSubmission(owner: string, scope: string, operation: string) {
  try { const row = cloudBindings(owner)[scope]; if (row?.submissionOperation === operation) forgetCloudBinding(owner, scope, row.id) } catch { /* Retain uncertain metadata; server tombstones still prevent replay. */ }
}
