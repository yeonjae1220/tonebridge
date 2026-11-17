'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { withRequestDeadline } from '@/lib/requestDeadline'
import { withWriteDeadline, WriteOutcomeUnknownError } from '@/lib/writeDeadline'
import { updateConfirmedQuery } from '@/lib/confirmedWriteCache'
import { getApiErrorStatus } from '@/lib/apiError'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { QueryError } from '@/components/ui/QueryError'

type Job = { id: string; includeAudio: boolean; state: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'EXPIRED'; createdAt: string; expiresAt: string | null; byteSize: number | null; failureCode: string | null }
type Pending = { operationId: string; includeAudio: boolean }
const labels = { QUEUED: 'exports.queued', RUNNING: 'exports.running', READY: 'exports.ready', FAILED: 'exports.failed', EXPIRED: 'exports.expired' } as const
export default function ExportPage() {
  const generation = useAuthStore(s => s.sessionGeneration)
  return <ExportContent key={generation} />
}
function ExportContent() {
  const { data: me } = useCurrentUser()
  const { accessToken, sessionGeneration } = useAuthStore()
  const { t, language } = useI18n()
  const client = useQueryClient()
  const [audio, setAudio] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const mounted = useRef(true)
  const downloadController = useRef<AbortController | null>(null)
  const downloadLock = useRef(false)
  const createLock = useRef(false)
  const storageKey = me ? 'tonebridge-export-operation:' + me.id : null
  const key = ['personal-exports', sessionGeneration]
  const current = () => mounted.current && sessionGeneration === useAuthStore.getState().sessionGeneration
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; downloadController.current?.abort() } }, [])
  useEffect(() => {
    if (!storageKey) return
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Pending | null
      if (value && /^[a-f0-9-]{36}$/.test(value.operationId) && typeof value.includeAudio === 'boolean') { setPending(value); setAudio(value.includeAudio) }
    } catch { /* A fresh explicit request can still use an in-memory identity. */ }
  }, [storageKey])
  const query = useQuery({ queryKey: key, enabled: !!accessToken && !!me,
    queryFn: ({ signal }) => withRequestDeadline(requestSignal => api.get<Job[]>('/users/me/exports', { signal: requestSignal }).then(r => r.data), 15000, signal),
    refetchInterval: query => query.state.data?.some(job => job.state === 'QUEUED' || job.state === 'RUNNING') ? 5000 : false,
  })
  useEffect(() => {
    if (!pending || !query.data?.some(job => job.id === pending.operationId)) return
    setPending(null)
    try { if (storageKey) sessionStorage.removeItem(storageKey) } catch { /* harmless metadata only */ }
  }, [pending, query.data, storageKey])
  const mutation = useMutation({
    mutationFn: (input: Pending) => withWriteDeadline(signal => api.post<Job>('/users/me/exports', input, { signal })),
    onSuccess: ({ data }) => {
      if (!current()) return
      updateConfirmedQuery<Job[]>(client, key, rows => [data, ...(rows ?? []).filter(job => job.id !== data.id)].slice(0, 20))
      setPending(null)
      try { if (storageKey) sessionStorage.removeItem(storageKey) } catch { /* retain server record */ }
      void client.invalidateQueries({ queryKey: key })
    }, onError: error => {
      if (current() && [400, 413, 422, 429].includes(getApiErrorStatus(error) ?? 0)) {
        setPending(null)
        try { if (storageKey) sessionStorage.removeItem(storageKey) } catch { /* no accepted job */ }
      }
    }, onSettled: () => { createLock.current = false },
  })
  const create = () => {
    if (!me || createLock.current) return
    createLock.current = true
    const input = pending ?? { operationId: crypto.randomUUID(), includeAudio: audio }
    setPending(input)
    try { if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify(input)) } catch { /* no automatic resend after reload */ }
    mutation.mutate(input)
  }
  const download = async (job: Job) => {
    if (downloadLock.current) return
    downloadLock.current = true; setDownloading(job.id); setDownloadError(null)
    const controller = new AbortController(); downloadController.current = controller
    try {
      const result = await withRequestDeadline(signal => api.get<Blob>(`/users/me/exports/${job.id}/download`, { responseType: 'blob', signal }), 120000, controller.signal)
      if (!current()) return
      const url = URL.createObjectURL(result.data)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'tonebridge-export-' + job.id + '.zip'; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      if (current()) setDownloadError(t(getApiErrorStatus(error) === 409 ? 'exports.changed' : 'error.unexpected'))
    } finally {
      downloadLock.current = false
      if (current()) setDownloading(null)
    }
  }
  if (!accessToken) return <main className="p-6"><Link href="/login?redirect=%2Fprofile%2Fexport">{t('exports.title')}</Link></main>
  const active = query.data?.some(job => job.state === 'QUEUED' || job.state === 'RUNNING')
  return <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
    <Link href="/profile/settings" className="text-blue-600">← {t('settings.title')}</Link>
    <h1 className="text-2xl font-bold">{t('exports.title')}</h1>
    <p className="text-sm">{t('exports.help')}</p><p className="text-xs text-gray-600">{t('exports.limit')}</p>
    <label className="flex items-center gap-3 py-2"><input type="checkbox" checked={audio} disabled={mutation.isPending || !!pending} onChange={event => setAudio(event.target.checked)} />{t('exports.audio')}</label>
    <button type="button" disabled={!me || mutation.isPending || (!!active && !pending)} onClick={create} className="min-h-11 rounded-xl bg-blue-700 px-4 text-white disabled:opacity-40">{t(mutation.isPending ? 'common.saving' : 'exports.create')}</button>
    <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="ml-3 min-h-11 text-blue-600">{t('access.refresh')}</button>
    {mutation.isError && !(mutation.variables && query.data?.some(job => job.id === mutation.variables?.operationId)) && <p role="alert" className="text-red-700">{t(mutation.error instanceof WriteOutcomeUnknownError ? 'common.actionUncertain' : getApiErrorStatus(mutation.error) === 429 ? 'exports.limit' : 'error.unexpected')}</p>}
    {downloadError && <p role="alert" className="text-red-700">{downloadError}</p>}
    {query.isError && <QueryError onRetry={() => void query.refetch()} />}
    {query.isPending ? <p role="status">{t('common.loading')}</p> : !query.isError && !query.data?.length ? <p>{t('exports.empty')}</p> : null}
    <ul className="space-y-3">{query.data?.map(job => <li key={job.id} className="space-y-2 rounded-xl border p-4">
      <p className="font-semibold">{t(labels[job.state])}</p>
      <p className="text-sm">{new Date(job.createdAt).toLocaleString(language)}{job.byteSize != null ? ` · ${(job.byteSize / 1024 / 1024).toFixed(1)} MB` : ''}</p>
      {job.state === 'FAILED' && <p className="text-sm text-red-700">{t(job.failureCode === 'EXPORT_LIMIT' ? 'exports.limit' : 'error.unexpected')}</p>}
      {job.state === 'READY' && <button type="button" disabled={!!downloading} onClick={() => void download(job)} className="min-h-11 text-blue-600 disabled:opacity-40">{t(downloading === job.id ? 'common.loading' : 'exports.download')}</button>}
    </li>)}</ul>
  </main>
}
