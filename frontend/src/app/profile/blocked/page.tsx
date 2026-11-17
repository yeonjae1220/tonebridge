'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { withRequestDeadline } from '@/lib/requestDeadline'
import { withWriteDeadline, WriteOutcomeUnknownError } from '@/lib/writeDeadline'
import { updateConfirmedQuery } from '@/lib/confirmedWriteCache'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { Dialog } from '@/components/ui/Dialog'
import { QueryError } from '@/components/ui/QueryError'

type Entry = { userId: string; username: string; createdAt: string }
type Page = { items: Entry[]; nextPage: number | null }
export default function BlockedPage() {
  const generation = useAuthStore(s => s.sessionGeneration)
  return <BlockedList key={generation} />
}
function BlockedList() {
  const { t } = useI18n()
  const { accessToken, sessionGeneration } = useAuthStore()
  const client = useQueryClient()
  const [selected, setSelected] = useState<Entry | null>(null)
  const key = ['blocked-users', sessionGeneration]
  const query = useInfiniteQuery({ queryKey: key, enabled: !!accessToken, initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => withRequestDeadline(requestSignal => api.get<Page>('/users/me/blocks', { params: { page: pageParam }, signal: requestSignal }).then(r => r.data), 15000, signal),
    getNextPageParam: page => page.nextPage ?? undefined,
  })
  const mutation = useMutation({
    mutationFn: (id: string) => withWriteDeadline(signal => api.delete(`/users/me/blocks/${id}`, { signal })),
    onSuccess: (_data, id) => {
      if (sessionGeneration !== useAuthStore.getState().sessionGeneration) return
      updateConfirmedQuery<InfiniteData<Page>>(client, key, data => data && ({ ...data, pages: data.pages.map(page => ({ ...page, items: page.items.filter(row => row.userId !== id) })) }))
      setSelected(null)
      void client.invalidateQueries({ queryKey: key })
    }, onError: () => {},
  })
  if (!accessToken) return <main className="p-6"><Link href="/login?redirect=%2Fprofile%2Fblocked">{t('blocks.title')}</Link></main>
  const entries = query.data?.pages.flatMap(page => page.items) ?? []
  return <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
    <Link href="/profile/settings" className="text-blue-600">← {t('settings.title')}</Link>
    <h1 className="text-2xl font-bold">{t('blocks.title')}</h1>
    <p className="text-sm">{t('blocks.unblockHelp')}</p>
    {query.isError && <QueryError onRetry={() => void query.refetch()} />}
    {query.isPending ? <p role="status">{t('common.loading')}</p> : !query.isError && !entries.length ? <p>{t('blocks.empty')}</p> : null}
    <ul className="space-y-3">{entries.map(entry => <li key={entry.userId} className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <span className="break-all">{entry.username}</span><button type="button" disabled={mutation.isPending} onClick={() => { mutation.reset(); setSelected(entry) }} className="min-h-11 shrink-0 px-2 text-blue-600">{t('blocks.unblock')}</button>
    </li>)}</ul>
    {query.hasNextPage && <button type="button" disabled={query.isFetching} onClick={() => void query.fetchNextPage()} className="min-h-11 text-blue-600">{t('feedback.more')}</button>}
    {selected && <Dialog title={t('blocks.unblock') + ' · ' + selected.username} busy={mutation.isPending} onClose={() => setSelected(null)}>
      <p>{t('blocks.unblockHelp')}</p>
      {mutation.isError && <p role="alert" className="my-3 text-red-700">{t(mutation.error instanceof WriteOutcomeUnknownError ? 'common.actionUncertain' : 'error.unexpected')}</p>}
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate(selected.userId)} className="mt-4 min-h-11 rounded-xl bg-blue-700 px-4 text-white disabled:opacity-40">{t(mutation.isPending ? 'common.saving' : 'blocks.unblock')}</button>
    </Dialog>}
  </main>
}
