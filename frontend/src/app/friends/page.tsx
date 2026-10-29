'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ALL_LANG_LABELS } from '@/constants/languages'
import { useDebounce } from '@/hooks/useDebounce'
import type { Friend, FriendRequest, UserSearchResult, StudySession } from '@/types'
import { useI18n } from '@/i18n/I18nProvider'
import { formatDate } from '@/lib/dateUtils'

function langLabel(code: string) {
  return ALL_LANG_LABELS[code] ?? code
}

function formatMessage(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  )
}

export default function FriendsPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()
  const { language, t } = useI18n()
  const { data: currentUser } = useCurrentUser()
  const [origin, setOrigin] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    if (!accessToken) router.replace('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search))
  }, [accessToken, router])

  useEffect(() => {
    setOrigin(window.location.origin)
    const invite = new URLSearchParams(window.location.search).get('invite')
    // Existing Google usernames can exceed the 20-character rename limit.
    // Match the persisted username and /users/search limit (50).
    if (invite && /^[A-Za-z0-9_]{2,50}$/.test(invite)) {
      setSearchQuery(invite)
      setShowSearch(true)
    }
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: friends = [], isLoading: friendsLoading, isError: friendsError } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/friends').then((r) => r.data),
    enabled: !!accessToken,
  })

  const { data: pending = [], isError: pendingError } = useQuery<FriendRequest[]>({
    queryKey: ['friends', 'pending'],
    queryFn: () => api.get('/friends/pending').then((r) => r.data),
    enabled: !!accessToken,
  })

  const { data: searchResults = [], isFetching: searchLoading, isError: searchError } = useQuery<UserSearchResult[]>({
    queryKey: ['users', 'search', debouncedQuery],
    queryFn: () =>
      api.get('/users/search', { params: { q: debouncedQuery, limit: 10 } }).then((r) => r.data),
    enabled: !!accessToken && debouncedQuery.trim().length >= 1,
  })

  const sendRequestMutation = useMutation({
    mutationFn: (receiverUsername: string) =>
      api.post('/friends/request', { receiverUsername }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      setNotice(t('friends.requestSent'))
      setSearchQuery('')
      setShowSearch(false)
      setSendError(null)
    },
    onError: (err: { response?: { status?: number; data?: { message?: string } } }) => {
      if (err?.response?.status === 409) {
        setSendError(t('friends.requestAlreadySent'))
      } else if (err?.response?.status === 404) {
        setSendError(t('friends.userNotFound'))
      } else {
        setSendError(t('friends.requestFailed'))
      }
    },
  })

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/friends/${requestId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] })
    },
    onError: () => setSendError(t('friends.requestFailed')),
    onSettled: () => setAcceptingId(null),
  })

  const declineMutation = useMutation({
    mutationFn: (requestId: string) => api.delete(`/friends/requests/${requestId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] }),
    onError: () => setSendError(t('friends.requestFailed')),
    onSettled: () => setDecliningId(null),
  })

  const removeMutation = useMutation({
    mutationFn: (friendId: string) => api.delete(`/friends/${friendId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
    onError: () => setSendError(t('friends.requestFailed')),
    onSettled: () => setRemovingId(null),
  })

  const practiceMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const { data: sessions } = await api.get<StudySession[]>('/sessions')
      const existing = sessions.find((session) => session.memberIds.length === 2 && session.memberIds.includes(friendId))
      if (existing) return existing.id
      const { data } = await api.post<StudySession>('/sessions', { friendId })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      return data.id
    },
    onSuccess: (id) => router.push('/study/' + id),
    onError: () => setSendError(t('study.createFailed')),
  })

  const inviteUrl = origin && currentUser ? origin + '/friends?invite=' + encodeURIComponent(currentUser.username) : ''

  const friendIds = new Set(friends.map((f) => f.id))

  if (!accessToken) return null

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('friends.title')}</h1>
          <button
            onClick={() => { setShowSearch(true); setSendError(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('friends.add')}
          </button>
        </div>

        {inviteUrl && (
          <section className="bg-surface rounded-2xl border border-gray-100 p-4 mb-4">
            <p className="text-sm font-semibold mb-2">{t('friends.inviteLink')}</p>
            <p className="text-xs text-gray-500 mb-3">{t('friends.inviteHelp')}</p>
            <input aria-label={t('friends.inviteLink')} readOnly value={inviteUrl}
              onFocus={(event) => event.target.select()} className="w-full border rounded-xl p-2 text-sm" />
            <button type="button" className="mt-2 text-sm font-semibold text-blue-600" onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteUrl)
                setNotice(t('friends.linkCopied'))
              } catch {
                setSendError(t('friends.copyFailed'))
              }
            }}>{t('friends.copyLink')}</button>
          </section>
        )}
        {notice && <p role="status" className="text-sm text-green-700 mb-3">{notice}</p>}
        {sendError && <p role="alert" className="text-sm text-red-500 mb-3">{sendError}</p>}
        {pendingError && <p role="alert" className="text-sm text-red-500 mb-3">{t('friends.loadFailed')}</p>}

        {/* 친구 검색 패널 */}
        {showSearch && (
          <div ref={searchRef} className="bg-surface rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('friends.searchTitle')}</p>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSendError(null) }}
                placeholder={t('friends.searchPlaceholder')}
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
                autoFocus
              />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {searchLoading && <p>{t('common.loading')}</p>}
            {searchError && <p role="alert" className="text-red-500">{t('friends.loadFailed')}</p>}

            {debouncedQuery.trim().length >= 1 && searchResults.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {searchResults.map((user) => {
                  const isFriend = friendIds.has(user.id)
                  return (
                    <div key={user.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm font-semibold text-gray-800">{user.username}</p>
                        <p className="text-xs text-gray-500">{langLabel(user.nativeLanguage)}</p>
                      </div>
                      {isFriend ? (
                        <span className="shrink-0 text-xs text-green-600 font-medium">{t('friends.alreadyFriends')}</span>
                      ) : (
                        <button
                          onClick={() => sendRequestMutation.mutate(user.username)}
                          disabled={sendRequestMutation.isPending}
                          className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
                        >
                          {t('friends.request')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {debouncedQuery.trim().length >= 1 && !searchLoading && !searchError && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">{t('friends.noSearchResults')}</p>
            )}
          </div>
        )}

        {/* 받은 친구 요청 */}
        {pending.length > 0 && (
          <section className="mb-4">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">{t('friends.pending')} ({pending.length})</h2>
            <div className="bg-surface rounded-2xl border border-gray-100 overflow-hidden">
              {pending.map((req, idx) => (
                <div
                  key={req.id}
                  className={`flex items-center justify-between px-4 py-3 ${idx < pending.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{req.senderUsername ?? t('friends.unknown')}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(req.createdAt, language)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAcceptingId(req.id); acceptMutation.mutate(req.id) }}
                      disabled={acceptingId === req.id || decliningId === req.id}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
                    >
                      {acceptingId === req.id ? t('friends.accepting') : t('friends.accept')}
                    </button>
                    <button
                      onClick={() => { setDecliningId(req.id); declineMutation.mutate(req.id) }}
                      disabled={decliningId === req.id || acceptingId === req.id}
                      className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      {decliningId === req.id ? t('friends.processing') : t('friends.decline')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 친구 목록 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">
            {t('friends.title')} {!friendsLoading && !friendsError ? `${friends.length}${t('friends.count')}` : ''}
          </h2>
          {friendsError ? (
            <div className="bg-surface rounded-2xl border border-red-100 py-10 text-center">
              <p className="text-sm text-red-500 font-medium">{t('friends.loadFailed')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('common.retryLater')}</p>
            </div>
          ) : friendsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-gray-100 py-12 text-center">
              <p className="text-3xl mb-3">👥</p>
              <p className="text-sm font-semibold text-gray-700">{t('friends.emptyTitle')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('friends.emptySubtitle')}</p>
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-gray-100 overflow-hidden">
              {friends.map((friend, idx) => (
                <div
                  key={friend.id}
                  className={`flex items-center justify-between px-4 py-3 ${idx < friends.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{friend.username}</p>
                      <p className="text-xs text-gray-500">{langLabel(friend.nativeLanguage)}</p>
                    </div>
                  </div>
                  <button type="button"
                    disabled={practiceMutation.isPending}
                    onClick={() => practiceMutation.mutate(friend.id)}
                    className="ml-auto px-3 py-2 text-xs font-semibold text-blue-600 disabled:opacity-40"
                  >{t('study.openCards')}</button>
                  <button
                    onClick={() => {
                      if (window.confirm(formatMessage(t('friends.removeConfirm'), { name: friend.username }))) {
                        setRemovingId(friend.id)
                        removeMutation.mutate(friend.id)
                      }
                    }}
                    disabled={removingId === friend.id}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-40"
                    aria-label={t('friends.remove')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
