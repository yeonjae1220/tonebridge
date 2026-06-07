'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type { Friend, FriendRequest, StudySession } from '@/types'
import { formatDate } from '@/lib/dateUtils'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useI18n } from '@/i18n/I18nProvider'

type CreateSessionPayload = {
  friendId?: string | null
  title?: string | null
}

function formatMessage(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  )
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

  const { data: sessions = [], isLoading, isError } = useQuery<StudySession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions').then((r) => r.data),
    enabled: !!accessToken,
  })

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/friends').then((r) => r.data),
    enabled: !!accessToken,
  })

  const { data: pendingRequests = [] } = useQuery<FriendRequest[]>({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setShowNewSession(false)
      setSelectedFriendId('')
      setSessionTitle('')
      setCreateError(null)
    },
    onError: () => setCreateError(t('study.createFailed')),
  })

  const endMutation = useMutation({
    mutationFn: (sessionId: string) => api.patch(`/sessions/${sessionId}/end`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
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

  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE')
  const endedSessions = sessions.filter((s) => s.status === 'ENDED')
  const personalSessions = activeSessions.filter((s) => s.memberIds.length === 1)
  const friendSessions = activeSessions.filter((s) => s.memberIds.length > 1)
  const personalSession = personalSessions[0]
  const todoCount = pendingRequests.length + activeSessions.length

  const openPersonalPractice = () => {
    if (personalSession) {
      router.push(`/study/${personalSession.id}`)
      return
    }
    createMutation.mutate(
      { title: t('study.personalDefault') },
      { onSuccess: (response) => router.push(`/study/${response.data.id}`) },
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('study.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('study.subtitle')}</p>
          </div>
          <button
            onClick={openPersonalPractice}
            disabled={createMutation.isPending}
            className="shrink-0 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            {t('study.writeNote')}
          </button>
        </div>

        <section className="bg-surface rounded-2xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">{t('study.todayTitle')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t('study.todaySubtitle')}</p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
              {todoCount}
            </span>
          </div>
          {pendingRequests.length === 0 && activeSessions.length === 0 ? (
            <p className="text-sm text-gray-500">{t('study.allCaughtUp')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pendingRequests.slice(0, 2).map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-blue-50 px-3 py-2">
                  <span className="text-sm font-semibold text-blue-800">
                    {request.senderUsername ?? t('friends.unknown')}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => acceptMutation.mutate(request.id)}
                      disabled={acceptMutation.isPending || declineMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold disabled:opacity-40"
                    >
                      {t('friends.accept')}
                    </button>
                    <button
                      type="button"
                      onClick={() => declineMutation.mutate(request.id)}
                      disabled={acceptMutation.isPending || declineMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-surface text-blue-700 border border-blue-200 text-xs font-semibold disabled:opacity-40"
                    >
                      {t('friends.decline')}
                    </button>
                  </div>
                </div>
              ))}
              {friendSessions.slice(0, 2).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => router.push(`/study/${session.id}`)}
                  className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 text-left"
                >
                  <span className="text-sm font-semibold text-gray-700 truncate">
                    {session.title ?? t('study.practiceDefault')}
                  </span>
                  <span className="text-xs text-green-600 font-semibold">{t('study.active')}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mb-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => router.push('/friends')}
            className="rounded-2xl border border-gray-100 bg-surface p-3 text-left transition-colors hover:border-blue-200"
          >
            <p className="text-xl font-black text-blue-600">{pendingRequests.length}</p>
            <p className="mt-1 text-xs font-bold text-gray-900">{t('study.inboxLane')}</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-gray-400">{t('study.inboxLaneSub')}</p>
          </button>
          <button
            type="button"
            onClick={openPersonalPractice}
            disabled={createMutation.isPending}
            className="rounded-2xl border border-gray-100 bg-surface p-3 text-left transition-colors hover:border-blue-200 disabled:opacity-40"
          >
            <p className="text-xl font-black text-gray-900">{personalSessions.length}</p>
            <p className="mt-1 text-xs font-bold text-gray-900">{t('study.myLane')}</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-gray-400">{t('study.myLaneSub')}</p>
          </button>
          <button
            type="button"
            onClick={() => { setShowNewSession(true); setCreateError(null) }}
            className="rounded-2xl border border-gray-100 bg-surface p-3 text-left transition-colors hover:border-blue-200"
          >
            <p className="text-xl font-black text-green-600">{friendSessions.length}</p>
            <p className="mt-1 text-xs font-bold text-gray-900">{t('study.friendLane')}</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-gray-400">{t('study.friendLaneSub')}</p>
          </button>
        </section>

        <section className="mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">{t('study.quickActions')}</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openPersonalPractice}
              disabled={createMutation.isPending}
              className="rounded-2xl bg-surface border border-gray-100 p-4 text-left hover:border-blue-200 transition-colors disabled:opacity-40"
            >
              <span className="block text-lg mb-2">✍️</span>
              <span className="text-sm font-bold text-gray-900">{t('study.writeNote')}</span>
              <span className="block text-xs text-gray-400 mt-1">{t('study.personalDefault')}</span>
            </button>
            <button
              type="button"
              onClick={openPersonalPractice}
              disabled={createMutation.isPending}
              className="rounded-2xl bg-surface border border-gray-100 p-4 text-left hover:border-blue-200 transition-colors disabled:opacity-40"
            >
              <span className="block text-lg mb-2">🎙</span>
              <span className="text-sm font-bold text-gray-900">{t('study.recordVoice')}</span>
              <span className="block text-xs text-gray-400 mt-1">{t('study.personalDefault')}</span>
            </button>
            <button
              type="button"
              onClick={() => { setShowNewSession(true); setCreateError(null) }}
              className="rounded-2xl bg-surface border border-gray-100 p-4 text-left hover:border-blue-200 transition-colors"
            >
              <span className="block text-lg mb-2">👥</span>
              <span className="text-sm font-bold text-gray-900">{t('study.sendFriend')}</span>
              <span className="block text-xs text-gray-400 mt-1">{t('friends.title')}</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/request')}
              className="rounded-2xl bg-surface border border-gray-100 p-4 text-left hover:border-blue-200 transition-colors"
            >
              <span className="block text-lg mb-2">💬</span>
              <span className="text-sm font-bold text-gray-900">{t('study.askCommunity')}</span>
              <span className="block text-xs text-gray-400 mt-1">{t('nav.feed')}</span>
            </button>
          </div>
        </section>

        {/* 새 세션 생성 패널 */}
        {showNewSession && (
          <div className="bg-surface rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">{t('study.newPractice')}</p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('study.friendRequired')}</label>
                {friends.length === 0 ? (
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
                  <select
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
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('study.nameOptional')}</label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder={t('study.namePlaceholder')}
                  maxLength={50}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              {createError && <p className="text-xs text-red-500">{createError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => createMutation.mutate({
                    friendId: selectedFriendId,
                    title: sessionTitle,
                  })}
                  disabled={!selectedFriendId || createMutation.isPending}
                  className="flex-1 py-2.5 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors"
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
          </div>
        )}

        {isError ? (
          <div className="bg-surface rounded-2xl border border-red-100 py-12 text-center">
            <p className="text-sm text-red-500 font-medium">{t('study.loadFailed')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('common.retryLater')}</p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-gray-100 py-12 px-5 text-center">
            <p className="text-sm font-semibold text-gray-700">{t('study.personalTitle')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('study.personalSubtitle')}</p>
            <button
              type="button"
              onClick={openPersonalPractice}
              disabled={createMutation.isPending}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 transition-colors"
            >
              {t('study.personalOpen')}
            </button>
          </div>
        ) : (
          <>
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
                        onEnd={canManage ? () => {
                          if (window.confirm(t('study.confirmEnd'))) {
                            endMutation.mutate(session.id)
                          }
                        } : undefined}
                        onRename={canManage ? () => setRenamingSession(session) : undefined}
                        onDelete={canManage ? () => {
                          if (window.confirm(t('study.confirmDelete'))) {
                            deleteMutation.mutate(session.id)
                          }
                        } : undefined}
                        ending={endMutation.isPending}
                      />
                    )
                  })}
                </div>
              </section>
            )}

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
                        onEnd={canManage ? () => {
                          if (window.confirm(t('study.confirmEnd'))) {
                            endMutation.mutate(session.id)
                          }
                        } : undefined}
                        onRename={canManage ? () => setRenamingSession(session) : undefined}
                        onDelete={canManage ? () => {
                          if (window.confirm(t('study.confirmDelete'))) {
                            deleteMutation.mutate(session.id)
                          }
                        } : undefined}
                        ending={endMutation.isPending}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {endedSessions.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 mb-2">{t('study.ended')} ({endedSessions.length})</h2>
                <div className="flex flex-col gap-3">
                  {endedSessions.map((session) => {
                    const canManage = currentUser?.id === session.createdBy
                    return (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onOpen={() => router.push(`/study/${session.id}`)}
                        ended
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
          </>
        )}
      </div>
      {renamingSession && (
        <RenameSessionSheet
          session={renamingSession}
          pending={updateMutation.isPending}
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
  onClose,
  onSubmit,
}: {
  session: StudySession
  pending: boolean
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
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center px-4 pb-4">
      <form onSubmit={submit} className="w-full max-w-lg bg-surface rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('study.renameTitle')}</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">×</button>
        </div>
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
          className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 transition-colors"
        >
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </div>
  )
}

interface SessionCardProps {
  session: StudySession
  onOpen: () => void
  onEnd?: () => void
  onRename?: () => void
  onDelete?: () => void
  ending?: boolean
  ended?: boolean
}

function SessionCard({ session, onOpen, onEnd, onRename, onDelete, ending, ended }: SessionCardProps) {
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {!ended && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 text-xs font-medium rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {t('study.active')}
            </span>
          )}
          {ended && (
            <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">{t('study.ended')}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onOpen}
          className="flex-1 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
        >
          {t('study.openCards')}
        </button>
        {!ended && onEnd && (
          <button
            onClick={onEnd}
            disabled={ending}
            className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            {t('study.endSession')}
          </button>
        )}
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
