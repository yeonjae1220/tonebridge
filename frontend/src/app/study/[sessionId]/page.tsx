'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type { StudyCard, StudySession } from '@/types'
import { formatDate } from '@/lib/dateUtils'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useI18n } from '@/i18n/I18nProvider'
import { localizedLabel } from '@/lib/localizedLabels'

export default function StudySessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const { language, t } = useI18n()
  const [cardSheet, setCardSheet] = useState<{ mode: 'create' } | { mode: 'edit'; card: StudyCard } | null>(null)
  const [movingCard, setMovingCard] = useState<StudyCard | null>(null)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: session, isLoading: sessionLoading } = useQuery<StudySession>({
    queryKey: ['sessions', sessionId],
    queryFn: () => api.get(`/sessions/${sessionId}`).then((r) => r.data),
    enabled: !!accessToken && !!sessionId,
  })

  const { data: cards = [], isLoading: cardsLoading, isError: cardsError } = useQuery<StudyCard[]>({
    queryKey: ['sessions', sessionId, 'cards'],
    queryFn: () => api.get(`/sessions/${sessionId}/cards`).then((r) => r.data),
    enabled: !!accessToken && !!sessionId,
  })

  const { data: sessions = [] } = useQuery<StudySession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions').then((r) => r.data),
    enabled: !!accessToken,
  })

  const updateCardMutation = useMutation({
    mutationFn: (card: StudyCard) => api.patch(`/cards/${card.id}`, {
      phrase: card.phrase,
      context: card.context,
      tags: card.tags,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'cards'] }),
  })

  const createCardMutation = useMutation({
    mutationFn: (payload: { phrase: string; context: string | null; tags: string[] }) =>
      api.post(`/sessions/${sessionId}/cards`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'cards'] })
      setCardSheet(null)
    },
  })

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => api.delete(`/cards/${cardId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'cards'] }),
  })

  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, targetSessionId, position }: { cardId: string; targetSessionId: string; position: number }) =>
      api.patch(`/cards/${cardId}/move`, { targetSessionId, position }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'cards'] })
      queryClient.invalidateQueries({ queryKey: ['sessions', variables.targetSessionId, 'cards'] })
      setMovingCard(null)
    },
  })

  if (!accessToken) return null

  const orderedCards = [...cards].sort((a, b) => a.position - b.position)

  const moveWithinSession = (card: StudyCard, position: number) => {
    moveCardMutation.mutate({
      cardId: card.id,
      targetSessionId: sessionId,
      position,
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="back"
          >
            ←
          </button>
          {sessionLoading ? (
            <div className="h-7 w-40 bg-gray-200 animate-pulse rounded-lg" />
          ) : (
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{session?.title ?? t('study.cards.sessionDefault')}</h1>
              {session && (
                <p className="text-xs text-gray-400">
                  {formatDate(session.createdAt, language)} · {t('study.members')} {session.memberIds.length}{t('friends.count')}
                  {session.status === 'ACTIVE' && (
                    <span className="ml-2 text-green-600 font-medium">{t('study.active')}</span>
                  )}
                </p>
              )}
            </div>
          )}
          {session?.status === 'ACTIVE' && (
            <button
              onClick={() => setCardSheet({ mode: 'create' })}
              className="px-3 py-2 rounded-xl bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
            >
              {t('study.cards.add')}
            </button>
          )}
        </div>

        {cardsError ? (
          <div className="bg-white rounded-2xl border border-red-100 py-12 text-center">
            <p className="text-sm text-red-500 font-medium">{t('study.cards.loadFailed')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('common.retryLater')}</p>
          </div>
        ) : cardsLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : orderedCards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center">
            <p className="text-4xl mb-3">🃏</p>
            <p className="text-sm font-semibold text-gray-700">{t('study.cards.emptyTitle')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('study.cards.emptySubtitle')}</p>
            {session?.status === 'ACTIVE' && (
              <button
                onClick={() => setCardSheet({ mode: 'create' })}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
              >
                {t('study.cards.first')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orderedCards.map((card, index) => {
              const canManage = currentUser?.id === card.createdByUserId
              return (
                <div
                  key={card.id}
                  draggable={canManage}
                  onDragStart={() => setDraggingCardId(card.id)}
                  onDragOver={(event) => {
                    if (canManage && draggingCardId) event.preventDefault()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const dragged = orderedCards.find((item) => item.id === draggingCardId)
                    setDraggingCardId(null)
                    if (!dragged || dragged.id === card.id) return
                    moveWithinSession(dragged, index)
                  }}
                  onDragEnd={() => setDraggingCardId(null)}
                  className={`bg-white rounded-2xl border p-5 transition-colors ${
                    draggingCardId === card.id ? 'border-blue-200 opacity-60' : 'border-gray-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/study/${sessionId}/cards/${card.id}`)}
                    className="w-full text-left"
                  >
                  <p className="text-base font-bold text-gray-900 mb-1">{card.phrase}</p>
                  {card.context && (
                    <p className="text-sm text-gray-500 mb-3">{card.context}</p>
                  )}
                  </button>
                  {card.explanation && (
                    <p className="text-sm text-gray-700 bg-blue-50 rounded-xl px-3 py-2 mb-3">
                      {card.explanation}
                    </p>
                  )}
                  {card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {card.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {localizedLabel(tag, t)}
                        </span>
                      ))}
                    </div>
                  )}
                  {card.latestAttempt && (
                    <div className="border-t border-gray-50 pt-3 mt-2">
                      <p className="text-xs font-semibold text-gray-500 mb-1">{t('study.cards.latestAttempt')}</p>
                      <div className="flex items-center gap-3">
                        {card.latestAttempt.score !== null && (
                          <span className={`text-sm font-bold ${card.latestAttempt.score >= 80 ? 'text-green-600' : card.latestAttempt.score >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {card.latestAttempt.score}{t('study.cards.score')}
                          </span>
                        )}
                        {card.latestAttempt.correctionNote && (
                          <p className="text-xs text-gray-600">{card.latestAttempt.correctionNote}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {canManage && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => moveWithinSession(card, Math.max(0, index - 1))}
                        disabled={index === 0 || moveCardMutation.isPending}
                        className="px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition-colors"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveWithinSession(card, index + 1)}
                        disabled={index === orderedCards.length - 1 || moveCardMutation.isPending}
                        className="px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition-colors"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => setCardSheet({ mode: 'edit', card })}
                        className="flex-1 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => setMovingCard(card)}
                        className="flex-1 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        {t('study.cards.move')}
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(t('study.cards.confirmDelete'))) {
                            deleteCardMutation.mutate(card.id)
                          }
                        }}
                        className="flex-1 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {cardSheet && (
        <CardSheet
          initial={cardSheet.mode === 'edit' ? cardSheet.card : undefined}
          pending={createCardMutation.isPending || updateCardMutation.isPending}
          onClose={() => setCardSheet(null)}
          onSubmit={(payload) => {
            if (cardSheet.mode === 'edit') {
              updateCardMutation.mutate({ ...cardSheet.card, ...payload })
              setCardSheet(null)
            } else {
              createCardMutation.mutate(payload)
            }
          }}
        />
      )}
      {movingCard && (
        <MoveCardSheet
          card={movingCard}
          sessions={sessions.filter((item) => item.status === 'ACTIVE')}
          currentSessionId={sessionId}
          pending={moveCardMutation.isPending}
          onClose={() => setMovingCard(null)}
          onSubmit={(payload) => {
            moveCardMutation.mutate({
              cardId: movingCard.id,
              targetSessionId: payload.targetSessionId,
              position: payload.position,
            })
          }}
        />
      )}
    </main>
  )
}

function CardSheet({
  initial,
  pending,
  onClose,
  onSubmit,
}: {
  initial?: StudyCard
  pending: boolean
  onClose: () => void
  onSubmit: (payload: { phrase: string; context: string | null; tags: string[] }) => void
}) {
  const [phrase, setPhrase] = useState(initial?.phrase ?? '')
  const [context, setContext] = useState(initial?.context ?? '')
  const [tagText, setTagText] = useState(initial?.tags.join(', ') ?? '')
  const { t } = useI18n()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = phrase.trim()
    if (!trimmed) return
    onSubmit({
      phrase: trimmed,
      context: context.trim() || null,
      tags: tagText.split(',').map((tag) => tag.trim()).filter(Boolean),
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center px-4 pb-4">
      <form onSubmit={submit} className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{initial ? t('study.cards.edit') : t('study.cards.new')}</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">×</button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500">{t('study.cards.phrase')}</span>
          <textarea
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            rows={3}
            autoFocus
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={t('study.cards.phrasePlaceholder')}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500">{t('study.cards.context')}</span>
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={t('study.cards.contextPlaceholder')}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500">{t('study.cards.tags')}</span>
          <input
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={t('study.cards.tagsPlaceholder')}
          />
        </label>
        <button
          type="submit"
          disabled={pending || !phrase.trim()}
          className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 transition-colors"
        >
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </div>
  )
}

function MoveCardSheet({
  card,
  sessions,
  currentSessionId,
  pending,
  onClose,
  onSubmit,
}: {
  card: StudyCard
  sessions: StudySession[]
  currentSessionId: string
  pending: boolean
  onClose: () => void
  onSubmit: (payload: { targetSessionId: string; position: number }) => void
}) {
  const [targetSessionId, setTargetSessionId] = useState(currentSessionId)
  const [position, setPosition] = useState(card.position)
  const { t } = useI18n()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ targetSessionId, position: Math.max(0, position) })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center px-4 pb-4">
      <form onSubmit={submit} className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('study.cards.move')}</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">×</button>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2">{card.phrase}</p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500">{t('study.cards.targetPractice')}</span>
          <select
            value={targetSessionId}
            onChange={(event) => setTargetSessionId(event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>{session.title ?? t('study.practiceDefault')}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500">{t('study.cards.position')}</span>
          <input
            type="number"
            min={0}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !targetSessionId}
          className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 transition-colors"
        >
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </div>
  )
}
