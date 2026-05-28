'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { ALL_LANG_LABELS } from '@/constants/languages'
import { useDebounce } from '@/hooks/useDebounce'
import type { Friend, FriendRequest, UserSearchResult } from '@/types'
import { useI18n } from '@/i18n/I18nProvider'

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
  const { t } = useI18n()

  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

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

  const { data: pending = [] } = useQuery<FriendRequest[]>({
    queryKey: ['friends', 'pending'],
    queryFn: () => api.get('/friends/pending').then((r) => r.data),
    enabled: !!accessToken,
  })

  const { data: searchResults = [] } = useQuery<UserSearchResult[]>({
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
    onSettled: () => setAcceptingId(null),
  })

  const declineMutation = useMutation({
    mutationFn: (requestId: string) => api.delete(`/friends/requests/${requestId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] }),
    onSettled: () => setDecliningId(null),
  })

  const removeMutation = useMutation({
    mutationFn: (friendId: string) => api.delete(`/friends/${friendId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
    onSettled: () => setRemovingId(null),
  })

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

        {/* 친구 검색 패널 */}
        {showSearch && (
          <div ref={searchRef} className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
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

            {sendError && <p className="text-xs text-red-500 mt-2">{sendError}</p>}

            {debouncedQuery.trim().length >= 1 && searchResults.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {searchResults.map((user) => {
                  const isFriend = friendIds.has(user.id)
                  return (
                    <div key={user.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{user.username}</p>
                        <p className="text-xs text-gray-500">{langLabel(user.nativeLanguage)}</p>
                      </div>
                      {isFriend ? (
                        <span className="text-xs text-green-600 font-medium">{t('friends.alreadyFriends')}</span>
                      ) : (
                        <button
                          onClick={() => sendRequestMutation.mutate(user.username)}
                          disabled={sendRequestMutation.isPending}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
                        >
                          {t('friends.request')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {debouncedQuery.trim().length >= 1 && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">{t('friends.noSearchResults')}</p>
            )}
          </div>
        )}

        {/* 받은 친구 요청 */}
        {pending.length > 0 && (
          <section className="mb-4">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">{t('friends.pending')} ({pending.length})</h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {pending.map((req, idx) => (
                <div
                  key={req.id}
                  className={`flex items-center justify-between px-4 py-3 ${idx < pending.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{req.senderUsername ?? t('friends.unknown')}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(req.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAcceptingId(req.id); acceptMutation.mutate(req.id) }}
                      disabled={acceptingId === req.id || decliningId === req.id}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
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
            <div className="bg-white rounded-2xl border border-red-100 py-10 text-center">
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
            <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center">
              <p className="text-3xl mb-3">👥</p>
              <p className="text-sm font-semibold text-gray-700">{t('friends.emptyTitle')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('friends.emptySubtitle')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
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
