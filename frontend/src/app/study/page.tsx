'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type { Friend, FriendRequest, StudySession, StudyCard } from '@/types'
import { formatDate } from '@/lib/dateUtils'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Dialog } from '@/components/ui/Dialog'
import { QueryError } from '@/components/ui/QueryError'
import { useI18n } from '@/i18n/I18nProvider'

type CreateSessionPayload = {
  friendId?: string | null
  title?: string | null
}

export default function StudyPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const { t } = useI18n()

  const [showNewSession, setShowNewSession] = useState(false)
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [sessionTitle, setSessionTitle] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [renamingSession, setRenamingSession] = useState<StudySession | null>(null)

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: sessions = [], isLoading, isError, refetch: refetchSessions } = useQuery<StudySession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions').then((r) => r.data),
    enabled: !!accessToken,
  })

  const { data: friends = [], isLoading: friendsLoading, isError: friendsError, refetch: refetchFriends } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/friends').then((r) => r.data),
    enabled: !!accessToken,
  })

  const { data: pendingRequests = [], isError: pendingError, isLoading: pendingLoading, refetch: refetchPending } = useQuery<FriendRequest[]>({
    queryKey: ['friends', 'pending'],
    queryFn: () => api.get('/friends/pending').then((r) => r.data),
    enabled: !!accessToken,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateSessionPayload) =>
      api.post('/sessions', {
        friendId: payload.friendId ?? null,
        title: payload.title?.trim() || null,
      }),
    onSuccess: (response) => {
      router.push('/study/' + response.data.id)
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setShowNewSession(false)
      setSelectedFriendId('')
      setSessionTitle('')
      setCreateError(null)
    },
    onError: () => setCreateError(t('study.createFailed')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string | null }) =>
      api.patch(`/sessions/${sessionId}`, { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/friends/${requestId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] })
    },
  })

  const declineMutation = useMutation({
    mutationFn: (requestId: string) => api.delete(`/friends/requests/${requestId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] }),
  })

  if (!accessToken) return null

  const personalSessions = sessions.filter((s) => s.memberIds.length === 1)
  const friendSessions = sessions.filter((s) => s.memberIds.length > 1)
  return (
    <main className="min-h-screen break-keep bg-gray-50 pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{t('study.title')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">{t('study.subtitle')}</p>
          </div>
          <button onClick={() => { setShowNewSession(true); setCreateError(null) }}
            className="min-h-11 rounded-xl bg-action-primary px-4 text-sm font-semibold text-white hover:bg-action-primary-hover">
            {t('study.sendFriend')}
          </button>
        </div>

        {!isLoading && !isError && sessions.length === 0 && (
          <section className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="text-lg font-bold text-gray-900">{t('study.firstTitle')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{t('study.firstHelp')}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href="/friends" className="rounded-xl bg-action-primary px-4 py-3 text-center text-sm font-semibold text-white">{t('friends.inviteLink')}</Link>
              <Link href="/request?destination=PERSONAL&kind=TEXT" className="rounded-xl border border-gray-200 bg-surface px-4 py-3 text-center text-sm font-semibold text-gray-700">{t('study.firstSolo')}</Link>
            </div>
          </section>
        )}

        <section className="mb-5 grid grid-cols-3 gap-2" aria-label={t('study.quickActions')}>
          {([
            ['TEXT', 'study.writeNote', '/request?destination=PERSONAL&kind=TEXT'],
            ['AUDIO', 'study.recordVoice', '/request?destination=PERSONAL&kind=AUDIO'],
            ['COMMUNITY', 'study.askCommunity', '/request?destination=COMMUNITY'],
          ] as const).map(([kind, key, href]) => <Link key={kind} href={href}
            className="flex min-h-16 items-center justify-center rounded-xl border border-gray-200 bg-surface px-3 py-4 text-center text-sm font-semibold text-gray-700 hover:border-blue-400">{t(key)}</Link>)}
        </section>

        {(pendingLoading || pendingError || pendingRequests.length > 0) && <section className="mb-5 rounded-2xl border border-gray-100 bg-surface p-5">
          <h2 className="mb-3 text-base font-bold text-gray-900">{t('friends.pending')}{!pendingLoading && !pendingError && ` (${pendingRequests.length})`}</h2>
          {pendingError ? <QueryError onRetry={() => void refetchPending()} /> : pendingLoading ? <p role="status">{t('common.loading')}</p> : <div className="space-y-3">
            {pendingRequests.slice(0, 2).map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3">
              <span className="break-all text-sm font-semibold text-gray-700">{request.senderUsername ?? t('friends.unknown')}</span>
              <div className="flex gap-2">
                <button onClick={() => acceptMutation.mutate(request.id)} disabled={acceptMutation.isPending || declineMutation.isPending} className="min-h-11 rounded-xl bg-action-primary px-4 text-sm font-semibold text-white disabled:opacity-40">{t('friends.accept')}</button>
                <button onClick={() => declineMutation.mutate(request.id)} disabled={acceptMutation.isPending || declineMutation.isPending} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm text-gray-600 disabled:opacity-40">{t('friends.decline')}</button>
              </div>
            </div>)}
            {pendingRequests.length > 2 && <Link href="/friends" className="block py-2 text-sm text-blue-600">{t('friends.title')} →</Link>}
          </div>}
        </section>}

        {!isError && friendSessions.length > 0 && currentUser && <RecentFeedback sessions={friendSessions} userId={currentUser.id} />}

        {!isError && sessions.length > 0 && <section className="mb-6 rounded-2xl border border-gray-100 bg-surface p-5">
          <h2 className="mb-3 text-base font-bold text-gray-900">{t('study.todayTitle')}</h2>
          <div className="space-y-2">{sessions.slice(0, 3).map((session) => <button key={session.id}
            onClick={() => router.push(`/study/${session.id}`)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700">
            <span className="truncate">{session.title ?? t('study.practiceDefault')}</span><span aria-hidden>→</span>
          </button>)}</div>
        </section>}

        {/* 새 세션 생성 패널 */}
        {showNewSession && (
          <Dialog title={t('study.newPractice')} onClose={() => setShowNewSession(false)} busy={createMutation.isPending}>

            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="practice-friend" className="text-sm font-medium text-gray-500 mb-1 block">{t('study.friendRequired')}</label>
                {friendsError ? (
                  <QueryError onRetry={() => void refetchFriends()} />
                ) : friendsLoading ? (
                  <p>{t('common.loading')}</p>
                ) : friends.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">
                    {t('study.noFriends')}{' '}
                    <button
                      onClick={() => router.push('/friends')}
                      className="text-blue-500 underline"
                    >
                      {t('study.addFriend')}
                    </button>
                  </p>
                ) : (
                  <select id="practice-friend" autoFocus
                    value={selectedFriendId}
                    onChange={(e) => setSelectedFriendId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-surface transition-colors"
                  >
                    <option value="">{t('study.selectFriend')}</option>
                    {friends.map((f) => (
                      <option key={f.id} value={f.id}>{f.username}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="practice-title" className="text-sm font-medium text-gray-500 mb-1 block">{t('study.nameOptional')}</label>
                <input
                  type="text" id="practice-title"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder={t('study.namePlaceholder')}
                  maxLength={50}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              {createError && <p role="alert" className="text-xs text-red-500">{createError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => createMutation.mutate({
                    friendId: selectedFriendId,
                    title: sessionTitle,
                  })}
                  disabled={!selectedFriendId || createMutation.isPending}
                  className="flex-1 py-2.5 bg-action-primary text-white text-sm font-semibold rounded-xl hover:bg-action-primary-hover disabled:opacity-40 transition-colors"
                >
                  {createMutation.isPending ? t('study.creating') : t('common.start')}
                </button>
                <button
                  onClick={() => { setShowNewSession(false); setCreateError(null) }}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </Dialog>
        )}

        {isError ? (
          <QueryError onRetry={() => void refetchSessions()} />
        ) : isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? null : (
          <details className="rounded-2xl border border-gray-200 bg-surface p-5">
            <summary className="mb-3 cursor-pointer text-sm font-semibold text-gray-700">{t('study.library')} ({sessions.length})</summary>
            {friendSessions.length > 0 && (
              <section className="mb-4">
                <h2 className="text-sm font-semibold text-gray-500 mb-2">{t('study.friendSessions')} ({friendSessions.length})</h2>
                <div className="flex flex-col gap-3">
                  {friendSessions.map((session) => {
                    const canManage = currentUser?.id === session.createdBy
                    return (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onOpen={() => router.push(`/study/${session.id}`)}
                        onRename={canManage ? () => setRenamingSession(session) : undefined}
                        onDelete={canManage ? () => {
                          if (window.confirm(t('study.confirmDelete'))) {
                            deleteMutation.mutate(session.id)
                          }
                        } : undefined}
                      />
                    )
                  })}
                </div>
              </section>
            )}
            {personalSessions.length > 0 && (
              <section className="mb-4">
                <h2 className="text-sm font-semibold text-gray-500 mb-2">{t('study.personalTitle')}</h2>
                <div className="flex flex-col gap-3">
                  {personalSessions.map((session) => {
                    const canManage = currentUser?.id === session.createdBy
                    return (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onOpen={() => router.push(`/study/${session.id}`)}
                        onRename={canManage ? () => setRenamingSession(session) : undefined}
                        onDelete={canManage ? () => {
                          if (window.confirm(t('study.confirmDelete'))) {
                            deleteMutation.mutate(session.id)
                          }
                        } : undefined}
                      />
                    )
                  })}
                </div>
              </section>
            )}

          </details>
        )}
        <p className="mt-6 text-sm"><Link href="/help" className="text-blue-600">{t('validation.help')}</Link></p>
      </div>
      {renamingSession && (
        <RenameSessionSheet
          session={renamingSession}
          pending={updateMutation.isPending}
          failed={updateMutation.isError}
          onClose={() => setRenamingSession(null)}
          onSubmit={(title) => {
            updateMutation.mutate({ sessionId: renamingSession.id, title }, {
              onSuccess: () => setRenamingSession(null),
            })
          }}
        />
      )}
    </main>
  )
}

function RenameSessionSheet({
  session,
  pending,
  failed,
  onClose,
  onSubmit,
}: {
  session: StudySession
  pending: boolean
  failed: boolean
  onClose: () => void
  onSubmit: (title: string | null) => void
}) {
  const [title, setTitle] = useState(session.title ?? '')
  const { t } = useI18n()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(title.trim() || null)
  }

  return (
    <Dialog title={t('study.renameTitle')} onClose={onClose} busy={pending}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {failed && <p role="alert" className="text-sm text-red-500">{t('error.unexpected')}</p>}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          maxLength={50}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder={t('study.namePlaceholder')}
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 rounded-xl bg-action-primary text-white text-sm font-semibold hover:bg-action-primary-hover disabled:opacity-40 transition-colors"
        >
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </Dialog>
  )
}

interface SessionCardProps {
  session: StudySession
  onOpen: () => void
  onRename?: () => void
  onDelete?: () => void
}

function SessionCard({ session, onOpen, onRename, onDelete }: SessionCardProps) {
  const { language, t } = useI18n()
  return (
    <div className="bg-surface rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            {session.title ?? t('study.practiceDefault')}
          </p>
          <p className="text-xs text-gray-400 mt-1">{formatDate(session.createdAt, language)} · {t('study.members')} {session.memberIds.length}{t('friends.count')}</p>
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={onOpen}
          className="flex-1 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
        >
          {t('study.openCards')}
        </button>
        {onRename && (
          <button
            onClick={onRename}
            className="px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {t('common.edit')}
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
          >
            {t('common.delete')}
          </button>
        )}
      </div>
    </div>
  )
}

function RecentFeedback({ sessions, userId }: { sessions: StudySession[]; userId: string }) {
  const { t } = useI18n()
  // Bound home requests; these are recent practice summaries, not an unread inbox.
  const recent = sessions.slice(0, 5)
  const queries = useQueries({ queries: recent.map((session) => ({
    queryKey: ['sessions', session.id, 'cards'],
    queryFn: () => api.get<StudyCard[]>(`/sessions/${session.id}/cards`).then((response) => response.data),
    refetchInterval: 30_000,
  })) })
  const failed = queries.some((query) => query.isError)
  const loading = queries.some((query) => query.isLoading)
  const feedback = queries.flatMap((query) => query.data ?? [])
    .filter((card) => card.latestAttempt?.learnerId === userId && card.latestAttempt.correctionNote)
    .sort((a, b) => b.latestAttempt!.attemptedAt.localeCompare(a.latestAttempt!.attemptedAt)).slice(0, 3)
  return <section className="mb-5 rounded-2xl border border-gray-100 bg-surface p-5">
    <h2 className="text-base font-bold text-gray-900">{t('study.recentFeedback')}</h2>
    <p className="mt-1 mb-3 text-sm text-gray-500">{t('study.recentFeedbackScope')}</p>
    {failed ? <QueryError onRetry={() => { queries.forEach((query) => void query.refetch()) }} /> : loading ? <p role="status">{t('common.loading')}</p> : feedback.length === 0 ? <p className="text-sm text-gray-500">{t('study.feedbackEmpty')}</p> : <div className="space-y-3">
      {feedback.map((card) => <Link key={card.id} href={`/study/${card.sessionId}/cards/${card.id}`} className="block rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="font-semibold text-gray-900">{card.phrase}</p>
        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{card.latestAttempt!.correctionNote}</p>
        <p className="mt-3 text-sm font-semibold text-blue-700">{t('study.retryWithFeedback')} →</p>
      </Link>)}
    </div>}
  </section>
}
