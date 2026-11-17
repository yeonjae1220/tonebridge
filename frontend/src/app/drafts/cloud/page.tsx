'use client'

import { CloudAudioPanel, CloudAudioPlayer, useAudioMessages } from '@/components/recorder/CloudAudioPanel'
import { recordingDrafts } from '@/lib/recordingDrafts'
import { restoreCloudAudioOnDevice } from '@/lib/cloudAudioRestore'
import { syncCloudRecordings, selectCloudRecording, uploadCloudRecording } from '@/lib/cloudAudioSync'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCloudOwner } from '@/hooks/useCloudOwner'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { editorSnapshot } from '@/lib/composeEditorDraft'
import { recoverySnapshots } from '@/lib/recoveryDraft'
import { loadComposition } from '@/lib/compositionDraft'
import { api } from '@/lib/api'
import { withRequestDeadline } from '@/lib/requestDeadline'
import { getApiErrorStatus } from '@/lib/apiError'
import { DraftStorageError } from '@/lib/draftStorageError'
import { downloadDraftBlob } from '@/components/recorder/DraftExportButton'
import { cloudBindings, onCloudChange, selectCloudDraft, canonical, saveCloudBindings, cacheCloudSettings, eraseLocalCloudMetadata,
  type CloudSettings, type CloudBinding, type CloudKind, type CloudValue, type CloudWrite } from '@/lib/cloudDraftLocal'
import { cloudSessionReady, readCloudSettings, setCloudSettings, setCloudAudioSettings, readCloudOperation, listCloudDrafts, readCloudDraft, readCloudHistory,
  restoreCloudRevision, deleteRemoteDraft, writeCloudCopy, synchronizeAllCloudDrafts, type RemoteDraft, type CloudRevision } from '@/lib/cloudDraftSync'
import { restoreCloudOnDevice, cloudDraftRoute, cloudLocalRevision } from '@/lib/cloudDraftRestore'

type LocalDraft = { scope: string; kind: CloudKind; value: CloudValue; revision: string; updatedAt: number }
type Action = { kind: 'settings'; body: { operationId: string; expectedVersion: number; enabled: boolean; erase: boolean }; createdAt: number }
  | { kind: 'audio-settings'; body: { operationId: string; expectedVersion: number; enabled: boolean }; createdAt: number }
  | { kind: 'write'; id: string; body: CloudWrite; sourceId?: string; createdAt: number }
  | { kind: 'delete' | 'restore'; id: string; revision?: number; body: { operationId: string; epoch: string; expectedVersion: number }; createdAt: number }
const preview = (value: CloudValue | null) => String(value?.contentText || value?.explanation || value?.phrase || '')
function localDrafts(owner: string, onError: () => void = () => {}) {
  const rows: LocalDraft[] = []
  try {
    const editor = editorSnapshot(owner)
    if (editor?.value.kind === 'TEXT' && !loadComposition(owner)) rows.push({ scope: 'compose', kind: 'editor', value: editor.value, revision: editor.handle.revision!, updatedAt: editor.updatedAt })
  } catch { onError() }
  for (const { row } of recoverySnapshots(owner, onError)) if (row.value && !row.pending) rows.push({ scope: row.scope, kind: row.value.kind, value: row.value, revision: row.revision, updatedAt: row.updatedAt })
  return rows
}
export default function CloudDraftPage() {
  const generation = useAuthStore(s => s.sessionGeneration)
  return <CloudDraftContent key={generation} />
}
function CloudDraftContent() {
  const { data: me, isError: ownerError, refetch: retryOwner } = useCloudOwner()
  const { sessionGeneration, accessToken } = useAuthStore()
  const { t, language } = useI18n()
  const router = useRouter()
  const audioMessages = useAudioMessages()
  const [settings, setSettings] = useState<CloudSettings | null>(null)
  const [remote, setRemote] = useState<RemoteDraft[] | null>(null)
  const [locals, setLocals] = useState<LocalDraft[]>([])
  const [bindings, setBindings] = useState<Record<string, CloudBinding>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [histories, setHistories] = useState<Record<string, CloudRevision[]>>({})
  const [pending, setPending] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [, tick] = useState(0)
  const mounted = useRef(true), busyLock = useRef(false), readSequence = useRef(0)
  const current = () => mounted.current && sessionGeneration === useAuthStore.getState().sessionGeneration && !!useAuthStore.getState().accessToken
  const storageKey = me ? 'tonebridge-cloud-manager:' + me.id : null
  const ready = !!me?.id && cloudSessionReady(me.id)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const localRefresh = useCallback(() => {
    if (!me?.id) return
    try { let partial = false; setLocals(localDrafts(me.id, () => { partial = true })); setBindings(cloudBindings(me.id)); if (partial) setError(t('drafts.changed')) } catch { setError(t('drafts.changed')) }
  }, [me?.id, t])
  useEffect(localRefresh, [localRefresh])
  useEffect(() => {
    const update = () => { tick(v => v + 1); localRefresh() }
    const unsubscribe = onCloudChange(update)
    window.addEventListener('storage', update)
    return () => { unsubscribe(); window.removeEventListener('storage', update) }
  }, [localRefresh])
  useEffect(() => {
    if (!storageKey) return
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Action | null
      if (value && typeof value.createdAt === 'number' && Date.now() - value.createdAt < 7 * 86400000 && value.body?.operationId) setPending(value)
      else sessionStorage.removeItem(storageKey)
    } catch { setError(t('drafts.changed')) }
  }, [storageKey, t])
  const refresh = useCallback(async () => {
    if (!me?.id || !cloudSessionReady(me.id)) return
    const sequence = ++readSequence.current
    setLoading(true); setError('')
    try {
      const [preferences, rows] = await Promise.all([readCloudSettings(me.id), listCloudDrafts(me.id)])
      if (!mounted.current || sessionGeneration !== useAuthStore.getState().sessionGeneration || sequence !== readSequence.current) return
      setSettings(preferences); setRemote(rows); localRefresh()
    } catch { if (mounted.current && sequence === readSequence.current) setError(t('cloud.network')) }
    finally { if (mounted.current && sequence === readSequence.current) setLoading(false) }
  }, [me?.id, sessionGeneration, localRefresh, t])
  const bindingSignature = Object.values(bindings).map(row => `${row.id}:${row.version}:${row.error ?? ''}`).join('|')
  useEffect(() => { if (ready) void refresh() }, [ready, refresh, bindingSignature])
  const run = async (task: () => Promise<void>) => {
    if (busyLock.current || !current() || !ready) return
    readSequence.current++; setLoading(false)
    busyLock.current = true; setBusy(true); setError(''); setNotice('')
    try { await task() } catch (failure) { if (current()) setError(t(getApiErrorStatus(failure) === 409 || failure instanceof DraftStorageError ? 'cloud.conflict' : getApiErrorStatus(failure) === 413 ? 'cloud.limit' : 'cloud.network')) }
    finally { busyLock.current = false; if (current()) { setBusy(false); localRefresh() } }
  }
  const perform = async (action: Action) => {
    if (!me || !storageKey) return
    sessionStorage.setItem(storageKey, JSON.stringify(action)); setPending(action)
    let applied = await readCloudOperation(me.id, action.body.operationId)
    let preferences: CloudSettings | undefined
    if (!applied) {
      if (action.kind === 'settings') { preferences = await setCloudSettings(me.id, action.body); applied = { id: null, version: preferences.version } }
      else if (action.kind === 'audio-settings') { preferences = await setCloudAudioSettings(me.id, action.body); applied = { id: null, version: preferences.version } }
      else if (action.kind === 'write') applied = await writeCloudCopy(me.id, action.id, action.body)
      else if (action.kind === 'delete') applied = await deleteRemoteDraft(me.id, action.id, action.body)
      else applied = await restoreCloudRevision(me.id, action.id, action.revision!, action.body)
    }
    if (!current()) return
    if (action.kind === 'settings' || action.kind === 'audio-settings') {
      preferences ??= await readCloudSettings(me.id)
      if (!current()) return
      if (action.kind === 'settings' && action.body.erase && preferences.version === applied.version && !preferences.enabled) { eraseLocalCloudMetadata(me.id); cacheCloudSettings(me.id, preferences); setNotice(t('cloud.eraseDone')) }
      setSettings(preferences)
    } else if (action.kind === 'write') {
      const rows = cloudBindings(me.id), row = rows[action.body.scope]
      if (row && (row.id === action.sourceId || row.id === action.id)) {
        rows[action.body.scope] = { ...row, id: action.id, epoch: action.body.epoch, version: applied.version, synced: canonical(action.body.value), dirty: canonical(row.value) !== canonical(action.body.value), request: null, error: null }
        saveCloudBindings(me.id, rows)
      }
    }
    sessionStorage.removeItem(storageKey); setPending(null)
    await refresh()
  }
  const action = (next: Action) => void run(async () => {
    try { await perform(next) } catch (failure) {
      if (current() && [400, 409, 413, 422].includes(getApiErrorStatus(failure) ?? 0)) {
        if (storageKey) sessionStorage.removeItem(storageKey); setPending(null)
      }
      throw failure
    }
  })
  const changeSettings = (enabled: boolean, erase = false) => {
    if (!settings || pending) return
    if (erase && !window.confirm(t('cloud.eraseConfirm'))) return
    action({ kind: 'settings', createdAt: Date.now(), body: { operationId: crypto.randomUUID(), expectedVersion: settings.version, enabled, erase } })
  }
  const uploadSelected = () => void run(async () => {
    if (!me || !settings) return
    const fresh = localDrafts(me.id)
    for (const scope of selected) {
      const seen = locals.find(row => row.scope === scope), now = fresh.find(row => row.scope === scope)
      if (!seen || !now || seen.revision !== now.revision) throw new DraftStorageError('conflict')
      selectCloudDraft(me.id, now.scope, now.kind, now.value, now.revision, settings, now.updatedAt)
    }
    setSelected([])
  })
  const applyRemote = (row: RemoteDraft) => void run(async () => {
    if (!me || !settings || !window.confirm(t(row.kind === 'recording' ? 'recording.replaceCloudConfirm' : 'cloud.replaceConfirm'))) return
    if (row.kind === 'recording') { const route = await restoreCloudAudioOnDevice(me.id, row, settings); if (current()) router.push(route); return }
    // Capture the local revision at confirmation, before the network read can delay restoration.
    const localRevision = cloudLocalRevision(me.id, row)
    const fresh = await readCloudDraft(me.id, row.id)
    if (!current() || fresh.version !== row.version) throw new DraftStorageError('conflict')
    await restoreCloudOnDevice(me.id, fresh, settings, localRevision)
    if (current()) router.push(cloudDraftRoute(fresh))
  })
  const resolve = (row: CloudBinding, copy: boolean) => {
    if (!settings?.epoch || !settings.enabled || pending) return
    if (copy && row.kind === 'recording') {
      void run(async () => {
        const source = (await recordingDrafts.list(me!.id)).find(item => 'audio:' + item.scope === row.scope && item.id === row.localRevision)
        if (!source) throw new DraftStorageError('conflict')
        const fresh = await readCloudSettings(me!.id)
        await selectCloudRecording(me!.id, source, fresh, true); await uploadCloudRecording(me!.id, row.scope); await refresh()
      }); return
    }
    const latest = remote?.find(item => item.id === row.id)
    if (!copy && (!latest || latest.pendingOperation)) return
    action({ kind: 'write', id: copy ? crypto.randomUUID() : row.id, sourceId: row.id, createdAt: Date.now(), body: {
      operationId: crypto.randomUUID(), epoch: settings.epoch, expectedVersion: copy ? 0 : latest!.version, kind: row.kind, scope: row.scope, value: row.value, editedAt: Date.now(),
    } })
  }
  const submission = (row: Pick<RemoteDraft, 'pendingOperation' | 'pendingKind'>, cancel: boolean) => void run(async () => {
    if (!row.pendingOperation) return
    const root = row.pendingKind === 'COMPOSITION' ? '/compositions/' : '/submissions/'
    const response = await withRequestDeadline(signal => cancel ? api.post<Record<string, unknown>>(root + row.pendingOperation + '/cancel', {}, { signal }) : api.get<Record<string, unknown>>(root + row.pendingOperation, { signal }), cancel ? 30000 : 15000)
    if (!current()) return
    const resultType = response.data?.type
    const rows = cloudBindings(me!.id)
    for (const [scope, binding] of Object.entries(rows)) if (/^audio:(practice|example):/.test(scope) && binding.submissionOperation === row.pendingOperation) {
      if (resultType === 'practice' || resultType === 'example') { const latest = cloudBindings(me!.id); if (latest[scope]?.submissionOperation === row.pendingOperation) { delete latest[scope]; saveCloudBindings(me!.id, latest) } }
      else if (cancel && resultType === 'cancelled') {
        const fresh = await readCloudDraft(me!.id, binding.id)
        if (!current()) return
        if (fresh.state === 'ACTIVE' && !fresh.pendingOperation) { const latest = cloudBindings(me!.id), currentBinding = latest[scope]; if (currentBinding?.id === binding.id && currentBinding.submissionOperation === row.pendingOperation && currentBinding.localRevision === binding.localRevision) { latest[scope] = { ...currentBinding, version: fresh.version, pendingLocal: false, submissionOperation: undefined, error: null }; saveCloudBindings(me!.id, latest) } }
      }
    }
    // Resolving an older receipt never deletes the current device's audio.
    setNotice(response.status === 204 || response.data.type === 'cancelled' ? t('cloud.cancel') : t('common.saved'))
    await refresh()
  })
  if (!accessToken) return <main className="p-6"><Link href="/login?redirect=%2Fdrafts%2Fcloud">{t('cloud.title')}</Link></main>
  const button = 'min-h-11 rounded-lg border px-3 py-2 text-sm disabled:opacity-40'
  const disabled = busy || !ready || !!pending
  const title = (kind: CloudKind) => kind === 'recording' ? audioMessages[0] : t(kind === 'editor' ? 'drafts.editor' : kind === 'feedback' ? 'recovery.feedback' : 'recovery.card')
  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 pb-24">
    <Link href="/drafts" className="text-blue-600">← {t('drafts.title')}</Link>
    <h1 className="text-2xl font-bold">{t('cloud.title')}</h1>
    <p className="text-sm">{t('cloud.help')}</p><p className="text-sm">{t('cloud.disableHelp')}</p>
    {settings && <section className="space-y-3 rounded-xl border p-4"><p className="font-semibold">{t(settings.enabled ? 'cloud.enabled' : 'cloud.disabled')}</p>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={disabled} onClick={() => changeSettings(!settings.enabled)}>{t(settings.enabled ? 'cloud.disable' : 'cloud.enable')}</button>
        <button className={button} disabled={disabled} onClick={() => changeSettings(false, true)}>{t('cloud.erase')}</button></div></section>}
    {me && settings && <CloudAudioPanel owner={me.id} settings={settings} disabled={disabled} change={() => action({ kind: 'audio-settings', createdAt: Date.now(), body: { operationId: crypto.randomUUID(), expectedVersion: settings.version, enabled: !settings.audioEnabled } })} />}
    <button className={button} disabled={busy || loading || !ready} onClick={() => void refresh()}>{t('cloud.refresh')}</button>
    {ownerError && <button className={button} onClick={() => void retryOwner()}>{t('common.retry')}</button>}
    {(loading && !ownerError) && <p role="status">{t('cloud.loading')}</p>}
    {(error || ownerError) && <p role="alert" className="text-red-700">{error || t('cloud.network')}</p>}
    {notice && <p role="status">{notice}</p>}
    {pending && <section className="rounded-xl border border-amber-300 p-4"><p>{t(busy ? 'common.saving' : 'common.actionUncertain')}</p><button className={button} disabled={busy || !ready} onClick={() => action(pending)}>{t('common.retry')}</button></section>}
    <section className="space-y-3"><h2 className="text-lg font-bold">{t('cloud.local')}</h2>
      {!locals.length && <p className="text-sm">{t('cloud.localEmpty')}</p>}
      {locals.filter(row => !bindings[row.scope]).map(row => <label key={row.scope} className="flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" className="mt-1" checked={selected.includes(row.scope)} disabled={disabled || !settings?.enabled} onChange={event => setSelected(previous => event.target.checked ? [...previous, row.scope] : previous.filter(scope => scope !== row.scope))} /><span><strong>{title(row.kind)}</strong><span className="mt-1 block whitespace-pre-wrap break-words text-sm">{preview(row.value).slice(0, 300)}</span></span></label>)}
      <button className={button} disabled={disabled || !settings?.enabled || !selected.length} onClick={uploadSelected}>{t('cloud.select')}</button>
      {Object.values(bindings).map(row => <article key={row.scope} className="space-y-2 rounded-xl border p-4" data-testid="cloud-local-binding"><h3 className="font-semibold">{title(row.kind)}</h3><p className="whitespace-pre-wrap break-words text-sm">{preview(row.value).slice(0, 300)}</p>
        <p>{t(row.error === 'expired' ? 'cloud.localExpired' : row.error === 'conflict' ? 'cloud.conflict' : row.error === 'limit' ? 'cloud.limit' : row.error === 'rate' ? 'cloud.rate' : row.error ? 'cloud.network' : row.pendingLocal ? 'cloud.pending' : row.dirty || row.request ? 'cloud.waiting' : 'cloud.synced')}</p>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={row.error === 'expired'} onClick={() => { if (row.kind === 'recording') void run(async () => { const source = (await recordingDrafts.list(me!.id)).find(item => item.scope === row.scope.slice(6) && item.id === row.localRevision); if (!source) throw new DraftStorageError('conflict'); downloadDraftBlob(source.draft.blob, 'tonebridge-recording.' + (source.draft.blob.type === 'audio/mp4' ? 'm4a' : source.draft.blob.type.split('/')[1])) }); else downloadDraftBlob(new Blob([JSON.stringify(row.value, null, 2)], { type: 'application/json' }), 'tonebridge-local-draft.json') }}>{row.kind === 'recording' ? audioMessages[6] : t('cloud.localDownload')}</button>
          {row.pendingLocal && row.submissionOperation && /^audio:(practice|example):/.test(row.scope) && <><button className={button} disabled={disabled} onClick={() => submission({ pendingOperation: row.submissionOperation!, pendingKind: 'SUBMISSION' }, false)}>{t('cloud.check')}</button><button className={button} disabled={disabled} onClick={() => submission({ pendingOperation: row.submissionOperation!, pendingKind: 'SUBMISSION' }, true)}>{t('cloud.cancel')}</button></>}
          {(row.error === 'network' || row.error === 'rate' || row.kind === 'recording' && row.error === 'conflict' && !row.pendingLocal) && <button className={button} disabled={disabled} onClick={() => void run(async () => { await syncCloudRecordings(me!.id, true); await synchronizeAllCloudDrafts(me!.id, true) })}>{t('cloud.retry')}</button>}
          {row.error === 'conflict' && <><button className={button} disabled={disabled || !settings?.enabled || row.kind === 'recording' && !row.audio?.ready || !remote?.some(item => item.id === row.id && !item.pendingOperation)} onClick={() => resolve(row, false)}>{t(row.kind === 'recording' ? 'recording.keepCloud' : 'cloud.keepMine')}</button><button className={button} disabled={disabled || !settings?.enabled || row.pendingLocal || (row.kind === 'recording' && !settings.audioEnabled)} onClick={() => resolve(row, true)}>{t(row.kind === 'recording' ? 'recording.copyCloud' : 'cloud.copy')}</button></>}
        </div></article>)}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-bold">{t('cloud.remote')}</h2>
      {remote?.length === 0 && !error && <p>{t('cloud.empty')}</p>}
      {remote?.map(row => <article key={row.id} className="space-y-3 rounded-xl border p-4" data-testid="cloud-remote-draft"><h3 className="font-semibold">{title(row.kind)}</h3><p className="whitespace-pre-wrap break-words text-sm">{preview(row.value).slice(0, 500)}</p>
        {row.kind === 'recording' && !!row.value?.assetId && <CloudAudioPlayer key={String(row.value.assetId)} owner={me!.id} asset={String(row.value.assetId)} />}
        <p className="text-xs">{t('cloud.updated')}: {new Date(row.updatedAt).toLocaleString(language)}</p>
        {row.pendingOperation && <p>{t(row.pendingPayload ? 'cloud.pending' : 'cloud.pendingReadOnly')}</p>}
        <div className="flex flex-wrap gap-2"><button className={button} disabled={disabled || (!!row.pendingOperation && !row.pendingPayload)} onClick={() => applyRemote(row)}>{t('cloud.useRemote')}</button>
          <button className={button} disabled={disabled} onClick={() => void run(async () => { const history = await readCloudHistory(me!.id, row.id); if (current()) setHistories(previous => ({ ...previous, [row.id]: history })) })}>{t('cloud.history')}</button>
          {!row.pendingOperation && <button className={button} disabled={disabled || !settings?.epoch} onClick={() => { if (window.confirm(t('cloud.deleteConfirm'))) action({ kind: 'delete', id: row.id, createdAt: Date.now(), body: { operationId: crypto.randomUUID(), epoch: settings!.epoch!, expectedVersion: row.version } }) }}>{t('cloud.delete')}</button>}
          {row.pendingOperation && <><button className={button} disabled={disabled} onClick={() => submission(row, false)}>{t('cloud.check')}</button><button className={button} disabled={disabled} onClick={() => submission(row, true)}>{t('cloud.cancel')}</button></>}
        </div>
        {histories[row.id]?.map(revision => <div key={revision.version} className="space-y-2 border-t pt-3"><p className="text-xs">{new Date(revision.createdAt).toLocaleString(language)}</p><p className="whitespace-pre-wrap break-words text-sm">{preview(revision.value).slice(0, 300)}</p>{row.kind === 'recording' && <CloudAudioPlayer owner={me!.id} asset={String(revision.value.assetId)} />}<button className={button} disabled={disabled || !settings?.enabled || !!row.pendingOperation} onClick={() => action({ kind: 'restore', id: row.id, revision: revision.version, createdAt: Date.now(), body: { operationId: crypto.randomUUID(), epoch: settings!.epoch!, expectedVersion: row.version } })}>{t('cloud.restore')}</button></div>)}
      </article>)}
    </section>
  </main>
}
