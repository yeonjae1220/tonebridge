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
    mutationFn: () =>
      api.post('/sessions', {
        friendId: selectedFriendId,
        title: sessionTitle.trim() || null,
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

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('study.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('study.subtitle')}</p>
          </div>
          <button
            onClick={() => { setShowNewSession(true); setCreateError(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('study.startPractice')}
          </button>
        </div>

        {pendingRequests.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
            <p className="text-sm font-bold text-blue-900 mb-3">
              {formatMessage(t('study.pendingFriendRequests'), { count: pendingRequests.length })}
            </p>
            <div className="flex flex-col gap-2">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3">
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
                      className="px-3 py-1.5 rounded-lg bg-white text-blue-700 border border-blue-200 text-xs font-semibold disabled:opacity-40"
                    >
                      {t('friends.decline')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <section className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500">{t('friends.title')}</h2>
            <button
              type="button"
              onClick={() => router.push('/friends')}
              className="text-xs font-semibold text-blue-500 hover:text-blue-600"
            >
              {t('friends.add')}
            </button>
          </div>
          {friends.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-400">
              {t('study.noFriends')}{' '}
              <button type="button" onClick={() => router.push('/friends')} className="text-blue-500 underline">
                {t('study.addFriend')}
              </button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {friends.map((friend) => (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => {
                    setSelectedFriendId(friend.id)
                    setShowNewSession(true)
                    setCreateError(null)
                  }}
                  className="shrink-0 w-20 flex flex-col items-center gap-2"
                >
                  <span className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    {friend.username.charAt(0).toUpperCase()}
                  </span>
                  <span className="w-full truncate text-xs font-medium text-gray-600">{friend.username}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 새 세션 생성 패널 */}
        {showNewSession && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
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
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white transition-colors"
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
                  onClick={() => createMutation.mutate()}
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
          <div className="bg-white rounded-2xl border border-red-100 py-12 text-center">
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
          <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center">
            <p className="text-4xl mb-3">📖</p>
            <p className="text-sm font-semibold text-gray-700">{t('study.emptyTitle')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('study.emptySubtitle')}</p>
          </div>
        ) : (
          <>
            {activeSessions.length > 0 && (
              <section className="mb-4">
                <h2 className="text-sm font-semibold text-gray-500 mb-2">{t('study.active')} ({activeSessions.length})</h2>
                <div className="flex flex-col gap-3">
                  {activeSessions.map((session) => {
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
      <form onSubmit={submit} className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-xl flex flex-col gap-4">
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
  const { t } = useI18n()
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            {session.title ?? t('study.practiceDefault')}
          </p>
          <p className="text-xs text-gray-400 mt-1">{formatDate(session.createdAt)} · {t('study.members')} {session.memberIds.length}{t('friends.count')}</p>
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
