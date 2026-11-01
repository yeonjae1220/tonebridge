'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { editorSnapshot, writeEditor } from '@/lib/composeEditorDraft'
import { compositionFile, loadComposition, type CompositionDraft } from '@/lib/compositionDraft'
import { recordingDrafts, type RecordingDraftSnapshot } from '@/lib/recordingDrafts'
import { DraftExportButton, audioExtension, downloadDraftBlob } from '@/components/recorder/DraftExportButton'
import { api } from '@/lib/api'
import type { StudyCard } from '@/types'

type Snapshot = { account: string; editor: ReturnType<typeof editorSnapshot>; pending: CompositionDraft | null; recordings: RecordingDraftSnapshot[] }
function CardLabel({ scope }: { scope: string }) {
  const { t } = useI18n()
  const cardId = scope === 'compose' ? null : scope.split(':')[1]
  const generation = useAuthStore(s => s.sessionGeneration)
  const { data, isError } = useQuery<StudyCard>({ queryKey: ['draft-card', generation, cardId], queryFn: () => api.get(`/cards/${encodeURIComponent(cardId!)}`).then(r => r.data), enabled: !!cardId, retry: false })
  if (scope === 'compose') return null
  return <p className="line-clamp-2 break-words text-sm">{isError ? t('drafts.unavailable') : data?.phrase ?? t('common.loading')}</p>
}
export default function DraftsPage() {
  const { t, language } = useI18n()
  const router = useRouter()
  const { accessToken, sessionGeneration } = useAuthStore()
  const { data: user, isError: userError, refetch } = useCurrentUser()
  const account = `${sessionGeneration}:${user?.id ?? ''}`
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sequence = useRef(0)
  const invalidate = useCallback(() => { sequence.current++ }, [])
  const current = useRef(account); current.current = account
  const refresh = useCallback(async () => {
    if (!accessToken || !user?.id) return
    const serial = ++sequence.current
    setLoading(true)
    const data: Snapshot = { account, editor: null, pending: null, recordings: [] }
    let failed = false
    try { data.editor = editorSnapshot(user.id) } catch { failed = true }
    try { data.pending = loadComposition(user.id) } catch { failed = true }
    try { data.recordings = await recordingDrafts.list(user.id) } catch { failed = true }
    if (serial !== sequence.current || current.current !== account || !useAuthStore.getState().accessToken) return
    setSnapshot(data); setLoading(false); setError(failed ? t('drafts.changed') : '')
  }, [accessToken, user?.id, account, t])
  useEffect(() => {
    if (!accessToken) { router.replace('/login'); return }
    void refresh()
    const update = () => void refresh()
    window.addEventListener('storage', update)
    window.addEventListener('focus', update)
    const unsubscribe = recordingDrafts.subscribe(update)
    return () => { invalidate(); window.removeEventListener('storage', update); window.removeEventListener('focus', update); unsubscribe() }
  }, [accessToken, router, refresh, invalidate])
  const run = async (action: () => Promise<void>, failure = 'drafts.changed' as 'drafts.changed' | 'drafts.unavailable') => {
    if (busy || !accessToken || current.current !== account) return
    setBusy(true); setError('')
    try { await action(); if (current.current === account) await refresh() }
    catch { if (current.current === account) setError(t(failure)) }
    finally { if (current.current === account) setBusy(false) }
  }
  const resumeRecording = async (row: RecordingDraftSnapshot) => {
    if (row.scope === 'compose') { router.push('/request'); return }
    const cardId = row.scope.split(':')[1]
    const { data: card } = await api.get<StudyCard>(`/cards/${encodeURIComponent(cardId)}`)
    if (current.current !== account || !useAuthStore.getState().accessToken) return
    if (!card?.sessionId || card.deletedAt) throw new Error('Card unavailable')
    router.push(`/study/${encodeURIComponent(card.sessionId)}/cards/${encodeURIComponent(cardId)}`)
  }
  if (!accessToken) return null
  const visible = snapshot?.account === account ? snapshot : null
  const timestamp = (value: number) => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
  const box = 'rounded-2xl border border-gray-200 bg-surface p-4 space-y-3'
  const actionClass = 'inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-3 text-sm font-semibold disabled:opacity-50'
  return <main className="min-h-screen bg-gray-50 pb-24 text-gray-900"><div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
    <Link href="/study" className="inline-flex min-h-11 items-center text-blue-500">← {t('study.library')}</Link>
    <header><h1 className="text-2xl font-bold">{t('drafts.title')}</h1><p className="mt-2 text-sm text-gray-600">{t('drafts.intro')}</p></header>
    <details><summary className="min-h-11 cursor-pointer py-3">{t('drafts.details')}</summary><p className="text-sm text-gray-600">{t('editor.retention')}</p></details>
    {(error || userError) && <div role="alert" className={box}><p>{error || t('drafts.changed')}</p><button type="button" className={actionClass} onClick={() => { if (userError) void refetch(); else void refresh() }}>{t('common.retry')}</button></div>}
    {loading && !userError && <p role="status">{t('common.loading')}</p>}
    {!loading && visible && !error && !visible.editor && !visible.pending && visible.recordings.length === 0 && <div className={box}><p>{t('drafts.empty')}</p><Link href="/request" className={actionClass}>{t('drafts.new')}</Link></div>}
    {visible?.pending && <section className={box} data-testid="pending-draft"><h2 className="font-bold">{t('drafts.pending')}</h2><p className="text-sm text-gray-600">{t('drafts.pendingHelp')}</p><p className="text-xs">{t('drafts.updated')}: {timestamp(visible.pending.createdAt)}</p><div className="flex flex-wrap gap-3"><Link href="/request" className={actionClass}>{t('drafts.continue')}</Link>
      <DraftExportButton value={{ ...visible.pending.input, selectedFriendId: visible.pending.input.friendId ?? '', selectedGoals: visible.pending.input.goals, sourceCardId: null, step: 2 }} />
      {visible.pending.input.kind === 'AUDIO' && <button type="button" className={actionClass} disabled={busy} onClick={() => void run(async () => { const file = await compositionFile(visible.pending!); if (current.current === account) downloadDraftBlob(file, `tonebridge-recording.${audioExtension(file.type)}`) })}>{t('recording.download')}</button>}
      </div></section>}
    {visible?.editor && <section className={box} data-testid="managed-editor"><h2 className="font-bold">{t('drafts.editor')}</h2>
      <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{visible.editor.value.contentText || visible.editor.value.context || t('drafts.editor')}</p>
      <p className="text-sm">{t(visible.editor.value.destination === 'FRIEND' ? 'request.destinationFriend' : visible.editor.value.destination === 'COMMUNITY' ? 'request.destinationCommunity' : 'request.destinationPersonal')}</p>
      <p className="text-xs text-gray-500">{t('drafts.updated')}: {timestamp(visible.editor.updatedAt)}</p>
      <div className="flex flex-wrap gap-3"><Link href="/request" className={actionClass}>{t('drafts.continue')}</Link><DraftExportButton value={visible.editor.value} />
        <button type="button" className={actionClass} disabled={busy} onClick={() => { if (window.confirm(t('drafts.discard'))) void run(() => writeEditor(visible.editor!.handle, null)) }}>{t('recording.discardDraft')}</button></div>
    </section>}
    {visible?.recordings.map(row => <section key={row.scope} className={box} data-testid="managed-recording">
      <h2 className="font-bold">{t(row.scope === 'compose' ? 'drafts.composeAudio' : row.scope.startsWith('practice:') ? 'drafts.practice' : 'drafts.example')}</h2>
      <CardLabel scope={row.scope} />
      <p className="text-xs text-gray-500">{t('drafts.updated')}: {timestamp(row.updatedAt)} · {Math.max(0, Math.floor(row.draft.duration))}s · {(row.draft.blob.size / 1024).toFixed(1)} KiB</p>
      {row.draft.interrupted && <p className="text-sm">{t('recording.interrupted')}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" className={actionClass} disabled={busy} onClick={() => void run(() => resumeRecording(row), 'drafts.unavailable')}>{t('drafts.continue')}</button>
        <button type="button" className={actionClass} onClick={() => downloadDraftBlob(row.draft.blob, `tonebridge-${new Date(row.updatedAt).toISOString().replace(/[:.]/g, '-')}.${audioExtension(row.draft.blob.type)}`)}>{t('recording.download')}</button>
        <button type="button" className={actionClass} disabled={busy} onClick={() => { if (window.confirm(t('drafts.discard'))) void run(() => recordingDrafts.discardSnapshot(row)) }}>{t('recording.discardDraft')}</button></div>
    </section>)}
  </div></main>
}
