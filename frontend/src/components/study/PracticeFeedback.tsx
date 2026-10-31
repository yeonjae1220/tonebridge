'use client'

import Link from 'next/link'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { formatDate } from '@/lib/dateUtils'
import { QueryError } from '@/components/ui/QueryError'
import type { PracticeFeedbackPage } from '@/types'

export function PracticeFeedback({ preview = false }: { preview?: boolean }) {
  const { t, language } = useI18n()
  const { accessToken, sessionGeneration } = useAuthStore()
  const { data: user } = useCurrentUser()
  const query = useInfiniteQuery<PracticeFeedbackPage>({
    queryKey: ['practice-feedback', sessionGeneration],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get('/practice-feedback', { params: { page: pageParam, size: 20 } }).then(r => r.data),
    getNextPageParam: page => page.nextPage ?? undefined,
    enabled: !!accessToken,
    refetchInterval: 30_000,
  })
  const items = [...new Map((query.data?.pages.flatMap(page => page.items) ?? []).map(item => [item.attemptId, item])).values()]
  return <section className="mb-5 rounded-2xl border border-gray-100 bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      {preview && <h2 className="text-base font-bold text-gray-900">{t('feedback.title')}</h2>}
      {preview && <Link href="/study/feedback" className="min-h-11 content-center text-sm font-semibold text-blue-600">{t('feedback.all')} →</Link>}
    </div>
    <p className="my-3 text-sm text-gray-500">{t('feedback.help')}</p>
    {query.isError ? <QueryError onRetry={() => { void query.refetch() }} retrying={query.isFetching} /> :
      query.isPending ? <p role="status">{t('common.loading')}</p> :
      items.length === 0 ? <p className="text-sm text-gray-500">{t('feedback.empty')}</p> :
      <div className="space-y-3">{(preview ? items.slice(0, 3) : items).map(item =>
        <Link key={item.attemptId} href={`/study/${item.sessionId}/cards/${item.cardId}#attempt-${item.attemptId}`}
          className="block rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-gray-500">{item.sessionTitle ?? t('study.practiceDefault')}</p>
          <p className="mt-1 font-semibold text-gray-900">{item.phrase}</p>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-gray-700">{item.correctionNote}</p>
          <p className="mt-2 text-xs text-gray-500">{item.correctionAuthorId === user?.id ? t('feedback.self') : item.correctionAuthorName ?? t('feedback.unknownAuthor')}</p>
          <p className="mt-1 text-xs text-gray-500">
            {t(item.correctionUpdatedAt ? 'feedback.updated' : 'feedback.legacy')} · {formatDate(item.correctionUpdatedAt ?? item.attemptedAt, language)}
          </p>
          <p className="mt-3 text-sm font-semibold text-blue-700">{t('feedback.open')} →</p>
        </Link>
      )}</div>}
    {!preview && !query.isError && query.hasNextPage && <button type="button" disabled={query.isFetching}
      onClick={() => { void query.fetchNextPage() }}
      className="mt-4 min-h-11 w-full rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-40">
      {query.isFetchingNextPage ? t('common.loading') : t('feedback.more')}
    </button>}
  </section>
}
