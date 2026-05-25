'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type { Friend, StudySession } from '@/types'
import { formatDate } from '@/lib/dateUtils'

export default function StudyPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()

  const [showNewSession, setShowNewSession] = useState(false)
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [sessionTitle, setSessionTitle] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

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
    enabled: !!accessToken && showNewSession,
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
    onError: () => setCreateError('스터디 세션 생성에 실패했습니다. 다시 시도해주세요.'),
  })

  const endMutation = useMutation({
    mutationFn: (sessionId: string) => api.patch(`/sessions/${sessionId}/end`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })

  if (!accessToken) return null

  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE')
  const endedSessions = sessions.filter((s) => s.status === 'ENDED')

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">스터디</h1>
          <button
            onClick={() => { setShowNewSession(true); setCreateError(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            새 세션
          </button>
        </div>

        {/* 새 세션 생성 패널 */}
        {showNewSession && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">새 스터디 세션</p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">함께 공부할 친구 *</label>
                {friends.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">
                    친구가 없습니다.{' '}
                    <button
                      onClick={() => router.push('/friends')}
                      className="text-blue-500 underline"
                    >
                      친구를 추가해보세요
                    </button>
                  </p>
                ) : (
                  <select
                    value={selectedFriendId}
                    onChange={(e) => setSelectedFriendId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white transition-colors"
                  >
                    <option value="">친구를 선택하세요</option>
                    {friends.map((f) => (
                      <option key={f.id} value={f.id}>{f.username}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">세션 제목 (선택)</label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="예: 영어 회화 연습"
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
                  {createMutation.isPending ? '생성 중...' : '시작하기'}
                </button>
                <button
                  onClick={() => { setShowNewSession(false); setCreateError(null) }}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {isError ? (
          <div className="bg-white rounded-2xl border border-red-100 py-12 text-center">
            <p className="text-sm text-red-500 font-medium">세션 목록을 불러오지 못했어요</p>
            <p className="text-xs text-gray-400 mt-1">잠시 후 다시 시도해주세요.</p>
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
            <p className="text-sm font-semibold text-gray-700">아직 스터디 세션이 없어요</p>
            <p className="text-xs text-gray-400 mt-1">친구와 함께 스터디 세션을 시작해보세요!</p>
          </div>
        ) : (
          <>
            {activeSessions.length > 0 && (
              <section className="mb-4">
                <h2 className="text-sm font-semibold text-gray-500 mb-2">진행 중 ({activeSessions.length})</h2>
                <div className="flex flex-col gap-3">
                  {activeSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onOpen={() => router.push(`/study/${session.id}`)}
                      onEnd={() => {
                        if (window.confirm('세션을 종료할까요?')) {
                          endMutation.mutate(session.id)
                        }
                      }}
                      ending={endMutation.isPending}
                    />
                  ))}
                </div>
              </section>
            )}

            {endedSessions.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 mb-2">종료됨 ({endedSessions.length})</h2>
                <div className="flex flex-col gap-3">
                  {endedSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onOpen={() => router.push(`/study/${session.id}`)}
                      ended
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

interface SessionCardProps {
  session: StudySession
  onOpen: () => void
  onEnd?: () => void
  ending?: boolean
  ended?: boolean
}

function SessionCard({ session, onOpen, onEnd, ending, ended }: SessionCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900 leading-snug">
            {session.title ?? '스터디 세션'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{formatDate(session.createdAt)} · 멤버 {session.memberIds.length}명</p>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!ended && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 text-xs font-medium rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              진행 중
            </span>
          )}
          {ended && (
            <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">종료</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onOpen}
          className="flex-1 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
        >
          카드 보기
        </button>
        {!ended && onEnd && (
          <button
            onClick={onEnd}
            disabled={ending}
            className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            세션 종료
          </button>
        )}
      </div>
    </div>
  )
}
