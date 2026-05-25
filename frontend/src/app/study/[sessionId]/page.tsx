'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import type { StudyCard, StudySession } from '@/types'
import { formatDate } from '@/lib/dateUtils'

export default function StudySessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const { accessToken } = useAuthStore()

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

  if (!accessToken) return null

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="뒤로가기"
          >
            ←
          </button>
          {sessionLoading ? (
            <div className="h-7 w-40 bg-gray-200 animate-pulse rounded-lg" />
          ) : (
            <div>
              <h1 className="text-xl font-bold text-gray-900">{session?.title ?? '스터디 세션'}</h1>
              {session && (
                <p className="text-xs text-gray-400">
                  {formatDate(session.createdAt)} · 멤버 {session.memberIds.length}명
                  {session.status === 'ACTIVE' && (
                    <span className="ml-2 text-green-600 font-medium">진행 중</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {cardsError ? (
          <div className="bg-white rounded-2xl border border-red-100 py-12 text-center">
            <p className="text-sm text-red-500 font-medium">카드를 불러오지 못했어요</p>
            <p className="text-xs text-gray-400 mt-1">잠시 후 다시 시도해주세요.</p>
          </div>
        ) : cardsLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center">
            <p className="text-4xl mb-3">🃏</p>
            <p className="text-sm font-semibold text-gray-700">아직 학습 카드가 없어요</p>
            <p className="text-xs text-gray-400 mt-1">모바일 앱에서 카드를 추가할 수 있습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cards.map((card) => (
              <div key={card.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-base font-bold text-gray-900 mb-1">{card.phrase}</p>
                {card.context && (
                  <p className="text-sm text-gray-500 mb-3">{card.context}</p>
                )}
                {card.explanation && (
                  <p className="text-sm text-gray-700 bg-blue-50 rounded-xl px-3 py-2 mb-3">
                    {card.explanation}
                  </p>
                )}
                {card.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {card.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {card.latestAttempt && (
                  <div className="border-t border-gray-50 pt-3 mt-2">
                    <p className="text-xs font-semibold text-gray-500 mb-1">내 최근 시도</p>
                    <div className="flex items-center gap-3">
                      {card.latestAttempt.score !== null && (
                        <span className={`text-sm font-bold ${card.latestAttempt.score >= 80 ? 'text-green-600' : card.latestAttempt.score >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {card.latestAttempt.score}점
                        </span>
                      )}
                      {card.latestAttempt.correctionNote && (
                        <p className="text-xs text-gray-600">{card.latestAttempt.correctionNote}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
