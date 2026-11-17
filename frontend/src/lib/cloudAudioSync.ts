import { api } from './api'
import { withRequestDeadline } from './requestDeadline'
import { getApiErrorStatus } from './apiError'
import { DraftStorageError } from './draftStorageError'
import { recordingDrafts, type RecordingDraftSnapshot } from './recordingDrafts'
import { editorSnapshot } from './composeEditorDraft'
import { openRecovery } from './recoveryDraft'
import { cloudBindings, saveCloudBindings, canonical, type CloudSettings } from './cloudDraftLocal'
import { captureCloudAccount, readCloudSettings, synchronizeCloudDraft } from './cloudDraftSync'

type Asset = { id: string; state: string; byteSize: number; contentType: string; sha256: string }
const root = '/users/me/draft-audio/'
export async function audioDigest(blob: Blob) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(v => v.toString(16).padStart(2, '0')).join('') }
export async function selectCloudRecording(owner: string, source: RecordingDraftSnapshot, settings: CloudSettings) {
  const account = captureCloudAccount(owner), scope = 'audio:' + source.scope
  if (!settings.enabled || !settings.audioEnabled || !settings.epoch || source.draft.interrupted || source.draft.blob.size > 50 * 1024 * 1024) throw new DraftStorageError('unavailable')
  const sha256 = await audioDigest(source.draft.blob); account.check()
  const fresh = (await recordingDrafts.list(owner)).find(row => row.scope === source.scope)
  if (fresh?.id !== source.id || fresh.updatedAt !== source.updatedAt) throw new DraftStorageError('conflict')
  const rows = cloudBindings(owner), previous = rows[scope]
  if (previous?.pendingLocal || previous?.request || previous?.error === 'conflict' || previous?.epoch !== undefined && previous.epoch !== settings.epoch) throw new DraftStorageError('conflict')
  const asset = previous?.audio?.sha256 === sha256 ? previous.audio : { sourceId: source.id, sourceUpdatedAt: source.updatedAt, assetId: crypto.randomUUID(), sha256, byteSize: source.draft.blob.size, contentType: source.draft.blob.type.split(';')[0], ready: false }
  const value: Record<string, unknown> = { assetId: asset.assetId, duration: source.draft.duration }
  const editor = source.scope === 'compose' ? editorSnapshot(owner)?.value : null
  if (editor?.kind === 'AUDIO') value.editor = editor
  const feedback = source.scope.startsWith('correction-reference:') ? openRecovery(owner, 'feedback:' + source.scope.split(':')[1]).row?.value : null
  if (feedback) value.feedback = feedback
  rows[scope] = { id: previous?.id ?? crypto.randomUUID(), epoch: settings.epoch, version: previous?.version ?? 0, kind: 'recording', scope, value,
    localRevision: source.id, updatedAt: source.updatedAt, synced: previous?.synced ?? null, dirty: canonical(value) !== previous?.synced, pendingLocal: false,
    request: null, error: null, audio: { ...asset, sourceId: source.id, sourceUpdatedAt: source.updatedAt } }
  account.check(); saveCloudBindings(owner, rows)
}
export async function uploadCloudRecording(owner: string, scope: string) {
  const initial = cloudBindings(owner)[scope]
  if (!initial || initial.pendingLocal && initial.audio?.ready) return
  const account = captureCloudAccount(owner)
  await withRequestDeadline(signal => navigator.locks.request('tonebridge-cloud-audio:' + owner + ':' + scope, { signal }, async () => {
    account.check()
    let row = cloudBindings(owner)[scope]
    if (!row?.audio || row.audio.ready) return
    const identity = row.audio.assetId
    try {
      const settings = await readCloudSettings(owner, signal)
      if (!settings.enabled || !settings.audioEnabled || settings.epoch !== row.epoch) return
      let asset: Asset | null = null
      try { asset = (await api.get<Asset>(root + identity, { signal })).data } catch (e) { if (getApiErrorStatus(e) !== 404) throw e }
      account.check()
      if (!asset) asset = (await api.put<Asset>(root + identity, { epoch: row.epoch, draftId: row.id, byteSize: row.audio.byteSize, contentType: row.audio.contentType, sha256: row.audio.sha256 }, { signal })).data
      account.check()
      if (asset.state !== 'READY') {
        if (asset.state !== 'RESERVED') throw new Error('Upload has not settled')
        const source = (await recordingDrafts.list(owner)).find(item => item.scope === scope.slice(6))
        if (!source || source.id !== row.audio.sourceId || source.draft.interrupted || await audioDigest(source.draft.blob) !== row.audio.sha256) throw new DraftStorageError('conflict')
        account.check()
        asset = (await api.put<Asset>(root + identity + '/file', source.draft.blob, { signal, timeout: 210000, headers: { 'Content-Type': row.audio.contentType } })).data
      }
      account.check(); signal.throwIfAborted()
      const rows = cloudBindings(owner); row = rows[scope]
      if (!row || row.audio?.assetId !== identity || asset.state !== 'READY') throw new DraftStorageError('conflict')
      rows[scope] = { ...row, audio: { ...row.audio, ready: true }, error: null }; saveCloudBindings(owner, rows)
    } catch (error) {
      account.check()
      const rows = cloudBindings(owner), current = rows[scope]
      if (current?.audio?.assetId === identity) { rows[scope] = { ...current, error: getApiErrorStatus(error) === 413 ? 'limit' : error instanceof DraftStorageError ? 'conflict' : 'network' }; saveCloudBindings(owner, rows) }
      throw error
    }
  }), 240000, account.signal)
  await synchronizeCloudDraft(owner, scope, true)
}
export async function retryCloudRecording(owner: string, scope: string) {
  const account = captureCloudAccount(owner), before = cloudBindings(owner)[scope]
  if (!before?.audio || before.audio.ready) return uploadCloudRecording(owner, scope)
  const status = await withRequestDeadline(signal => api.get<Asset>(root + before.audio!.assetId, { signal }).then(r => r.data), 15000, account.signal).catch(error => { if (getApiErrorStatus(error) === 404) return null; throw error })
  account.check()
  if (status && ['DELETING', 'DELETED'].includes(status.state)) {
    const rows = cloudBindings(owner), row = rows[scope]
    if (row?.audio?.assetId !== before.audio.assetId || row.request) throw new DraftStorageError('conflict')
    const assetId = crypto.randomUUID()
    rows[scope] = { ...row, value: { ...row.value, assetId }, audio: { ...row.audio, assetId, ready: false }, error: null, dirty: true }
    saveCloudBindings(owner, rows)
  }
  return uploadCloudRecording(owner, scope)
}
export async function syncCloudRecordings(owner: string, retry = false) {
  for (const row of Object.values(cloudBindings(owner))) if (row.kind === 'recording' && !row.pendingLocal && (!row.error || retry && ['network', 'rate'].includes(row.error))) {
    try { if (retry) await retryCloudRecording(owner, row.scope); else await uploadCloudRecording(owner, row.scope) } catch { captureCloudAccount(owner).check() }
  }
}
export async function downloadCloudRecording(owner: string, id: string) {
  const account = captureCloudAccount(owner)
  const info = await withRequestDeadline(signal => api.get<Asset>(root + id, { signal }).then(r => r.data), 15000, account.signal)
  if (info.state !== 'READY' || info.byteSize > 50 * 1024 * 1024) throw new DraftStorageError('corrupt')
  const file = await withRequestDeadline(signal => api.get<Blob>(root + id + '/file', { signal, responseType: 'blob', timeout: 120000 }).then(r => r.data), 120000, account.signal)
  account.check()
  if (file.size !== info.byteSize || await audioDigest(file) !== info.sha256) throw new DraftStorageError('corrupt')
  account.check(); return { blob: new Blob([file], { type: info.contentType }), info }
}
