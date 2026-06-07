'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { CorrectionRequest, LanguageVariant } from '@/types'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ALL_LANG_LABELS } from '@/constants/languages'
import { useI18n } from '@/i18n/I18nProvider'
import { localizedLabel } from '@/lib/localizedLabels'

type TFunction = ReturnType<typeof useI18n>['t']
type FeedTab = 'help' | 'mine' | 'done'

function formatMessage(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  )
}

function timeAgo(iso: string, t: TFunction) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('feed.time.now')
  if (m < 60) return formatMessage(t('feed.time.minutesAgo'), { count: m })
  const h = Math.floor(m / 60)
  if (h < 24) return formatMessage(t('feed.time.hoursAgo'), { count: h })
  return formatMessage(t('feed.time.daysAgo'), { count: Math.floor(h / 24) })
}

function rewardLabel(req: CorrectionRequest) {
  if (req.type === 'AUDIO') return '+8~12'
  return '+4'
}

function GuestBanner() {
  const router = useRouter()
  const { t } = useI18n()
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-blue-800">{t('feed.guestTitle')}</p>
        <p className="text-xs text-blue-600 mt-0.5">{t('feed.guestSubtitle')}</p>
      </div>
      <button
        onClick={() => router.push('/login?redirect=/feed')}
        className="shrink-0 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
      >
        {t('feed.login')}
      </button>
    </div>
  )
}

export default function FeedPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()
  const { t } = useI18n()
  const isGuest = !accessToken
  const [tab, setTab] = useState<FeedTab>('help')
  const [editingRequest, setEditingRequest] = useState<CorrectionRequest | null>(null)

  const { data: currentUser } = useCurrentUser()

  const { data: variantsMap } = useQuery<Record<string, LanguageVariant[]>>({
    queryKey: ['language-variants'],
    queryFn: () => api.get('/languages/variants').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  })

  const variantLabels = useMemo(() => {
    const map: Record<string, string> = {}
    if (variantsMap) {
      Object.values(variantsMap).flat().forEach((v) => { map[v.code] = v.label })
    }
    return map
  }, [variantsMap])

  const variantLabel = (code: string) =>
    variantLabels[code] ?? ALL_LANG_LABELS[code] ?? code

  const feedQuery = useQuery<CorrectionRequest[]>({
    queryKey: ['correction-feed'],
    queryFn: () => api.get('/correction-requests/feed?limit=20').then((r) => r.data),
    enabled: !isGuest,
  })

  const myRequestsQuery = useQuery<CorrectionRequest[]>({
    queryKey: ['my-requests'],
    queryFn: () => api.get('/correction-requests/mine').then((r) => r.data),
    enabled: !isGuest,
  })

  const updateRequestMutation = useMutation({
    mutationFn: (payload: CorrectionRequest) => api.patch(`/correction-requests/${payload.id}`, {
      targetLanguage: payload.targetLanguage,
      targetVariant: payload.targetVariant,
      contentText: payload.type === 'TEXT' ? payload.contentText : null,
      context: payload.context,
      feedbackGoals: payload.feedbackGoals,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-requests'] }),
  })

  const deleteRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.delete(`/correction-requests/${requestId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-requests'] }),
  })

  const correctorVariants = new Set<string>([
    ...(currentUser?.fluentLanguages ?? []),
    currentUser?.nativeLanguage ?? '',
  ].filter(Boolean))

  const handleRequestClick = () => {
    if (isGuest) {
      router.push('/login?redirect=/request')
      return
    }
    router.push('/request')
  }

  const handleDelete = (requestId: string) => {
    if (window.confirm(t('request.deleteConfirm'))) {
      deleteRequestMutation.mutate(requestId)
    }
  }

  const pendingMine = (myRequestsQuery.data ?? []).filter((req) =>
    ['PENDING', 'IN_PROGRESS'].includes(req.status),
  )
  const completedMine = (myRequestsQuery.data ?? []).filter((req) =>
    ['COMPLETED', 'AI_COMPLETED'].includes(req.status) || !!req.acceptedCorrectionId,
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('feed.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('feed.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {currentUser && currentUser.correctionStreak > 0 && (
              <button
                onClick={() => router.push('/profile')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-xl text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
              >
                🔥 {formatMessage(t('feed.streakDays'), { count: currentUser.correctionStreak })}
              </button>
            )}
            <button
              onClick={handleRequestClick}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
            >
              {t('feed.request')}
            </button>
          </div>
        </div>

        {isGuest && <GuestBanner />}

        {!isGuest && (
          <section className="mb-4 rounded-2xl border border-gray-100 bg-surface p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <CommunityMetric label={t('feed.helpRequests')} value={feedQuery.data?.length ?? 0} />
              <CommunityMetric label={t('feed.myRequests')} value={pendingMine.length} />
              <CommunityMetric label={t('feed.doneRequests')} value={completedMine.length} />
            </div>
          </section>
        )}

        {!isGuest && (
          <div className="mb-4 flex rounded-xl bg-gray-100 p-1 gap-1">
            {([
              ['help', t('feed.helpRequests')],
              ['mine', t('feed.myRequests')],
              ['done', t('feed.doneRequests')],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  tab === value ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === 'help' ? (
          <RequestList
            requests={feedQuery.data}
            isLoading={!isGuest && feedQuery.isLoading}
            emptyMessage={t('feed.empty')}
            correctorVariants={correctorVariants}
            variantLabel={variantLabel}
            onCardClick={(req) => router.push(isGuest ? `/login?redirect=/correct/${req.id}` : `/correct/${req.id}`)}
          />
        ) : tab === 'mine' ? (
          <RequestList
            requests={pendingMine}
            isLoading={myRequestsQuery.isLoading}
            emptyMessage={t('feed.myRequestsEmpty')}
            correctorVariants={correctorVariants}
            variantLabel={variantLabel}
            onCardClick={(req) => router.push(`/result/${req.id}`)}
            mine
            onEdit={(req) => setEditingRequest(req)}
            onDelete={handleDelete}
          />
        ) : (
          <RequestList
            requests={completedMine}
            isLoading={myRequestsQuery.isLoading}
            emptyMessage={t('feed.doneRequestsEmpty')}
            correctorVariants={correctorVariants}
            variantLabel={variantLabel}
            onCardClick={(req) => router.push(`/result/${req.id}`)}
            mine
            completed
          />
        )}
      </div>
      {editingRequest && (
        <RequestEditSheet
          request={editingRequest}
          pending={updateRequestMutation.isPending}
          onClose={() => setEditingRequest(null)}
          onSubmit={(payload) => {
            updateRequestMutation.mutate({ ...editingRequest, ...payload }, {
              onSuccess: () => setEditingRequest(null),
            })
          }}
        />
      )}
    </main>
  )
}

function CommunityMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <p className="text-lg font-black text-gray-900">{value}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-gray-500">{label}</p>
    </div>
  )
}

function RequestList({
  requests,
  isLoading,
  emptyMessage,
  correctorVariants,
  variantLabel,
  onCardClick,
  mine = false,
  completed = false,
  onEdit,
  onDelete,
}: {
  requests?: CorrectionRequest[]
  isLoading: boolean
  emptyMessage: string
  correctorVariants: Set<string>
  variantLabel: (code: string) => string
  onCardClick: (request: CorrectionRequest) => void
  mine?: boolean
  completed?: boolean
  onEdit?: (request: CorrectionRequest) => void
  onDelete?: (requestId: string) => void
}) {
  const { t } = useI18n()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((req) => {
        const isDialectMatch = !!req.targetVariant && correctorVariants.has(req.targetVariant)
        return (
          <RequestCard
            key={req.id}
            request={req}
            isDialectMatch={isDialectMatch}
            variantLabel={variantLabel}
            onClick={() => onCardClick(req)}
            mine={mine}
            completed={completed}
            onEdit={req.status === 'PENDING' ? () => onEdit?.(req) : undefined}
            onDelete={req.status === 'PENDING' ? () => onDelete?.(req.id) : undefined}
            t={t}
          />
        )
      })}
    </div>
  )
}

function RequestCard({
  request,
  isDialectMatch,
  variantLabel,
  onClick,
  mine,
  completed,
  onEdit,
  onDelete,
  t,
}: {
  request: CorrectionRequest
  isDialectMatch: boolean
  variantLabel: (code: string) => string
  onClick: () => void
  mine: boolean
  completed: boolean
  onEdit?: () => void
  onDelete?: () => void
  t: TFunction
}) {
  return (
    <article
      className={`bg-surface rounded-2xl border p-5 hover:border-blue-200 transition-colors cursor-pointer ${
        isDialectMatch ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-100'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
            {ALL_LANG_LABELS[request.targetLanguage] ?? request.targetLanguage}
          </span>
          {request.targetVariant && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              isDialectMatch ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {variantLabel(request.targetVariant)}
            </span>
          )}
          {request.type === 'AUDIO' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
              🎙 {t('common.audio')}
            </span>
          )}
          {request.type === 'TEXT' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
              {t('common.text')}
            </span>
          )}
          {mine && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              completed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {statusLabel(request.status, t)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!mine && <span className="text-sm font-bold text-green-600">{rewardLabel(request)} {t('feed.credits')}</span>}
          <span className="text-xs text-gray-400">{timeAgo(request.createdAt, t)}</span>
        </div>
      </div>

      {request.type === 'TEXT' ? (
        <p className="text-sm leading-6 text-gray-800 line-clamp-3 mb-3">{request.contentText}</p>
      ) : (
        <p className="text-sm text-gray-500 mb-3">🎙 {t('feed.audioRequest')}</p>
      )}

      {request.feedbackGoals && request.feedbackGoals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {request.feedbackGoals.map((g) => (
            <span key={g} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
              {localizedLabel(g, t)}
            </span>
          ))}
        </div>
      )}

      {request.context && (
        <p className="text-xs text-gray-400 mt-2">&quot;{request.context}&quot;</p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-gray-50 pt-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onClick()
          }}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
            mine
              ? 'bg-gray-900 text-white hover:bg-gray-800'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {mine ? t('feed.viewResult') : t('feed.correctNow')}
        </button>
        {mine && (onEdit || onDelete) && (
          <>
          {onEdit && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t('common.edit')}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
              className="px-3 py-2 rounded-xl border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              {t('common.delete')}
            </button>
          )}
          </>
        )}
      </div>
    </article>
  )
}

function statusLabel(status: CorrectionRequest['status'], t: TFunction) {
  if (status === 'PENDING') return t('feed.statusPending')
  if (status === 'IN_PROGRESS') return t('feed.statusInProgress')
  if (status === 'COMPLETED' || status === 'AI_COMPLETED') return t('feed.statusCompleted')
  if (status === 'EXPIRED') return t('feed.statusExpired')
  return status
}

function RequestEditSheet({
  request,
  pending,
  onClose,
  onSubmit,
}: {
  request: CorrectionRequest
  pending: boolean
  onClose: () => void
  onSubmit: (payload: Partial<CorrectionRequest>) => void
}) {
  const [contentText, setContentText] = useState(request.contentText ?? '')
  const [context, setContext] = useState(request.context ?? '')
  const { t } = useI18n()
  const isAudio = request.type === 'AUDIO'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      contentText: isAudio ? request.contentText : contentText.trim(),
      context: context.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center px-4 pb-4">
      <form onSubmit={submit} className="w-full max-w-lg bg-surface rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('request.editTitle')}</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">×</button>
        </div>
        {!isAudio && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500">{t('request.contentLabel')}</span>
            <textarea
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              rows={4}
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500">{t('request.context')}</span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
        <button type="submit" disabled={pending} className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold disabled:opacity-40">
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </div>
  )
}
