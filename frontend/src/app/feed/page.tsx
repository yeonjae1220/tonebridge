'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { CorrectionRequest } from '@/types'

const LANG_LABELS: Record<string, string> = {
  ko: '한국어', ja: '일본어', zh: '중국어', en: '영어', es: '스페인어', fr: '프랑스어',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

function rewardLabel(req: CorrectionRequest) {
  if (req.type === 'AUDIO') return '+8~12'
  return '+4'
}

export default function FeedPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: requests, isLoading } = useQuery<CorrectionRequest[]>({
    queryKey: ['correction-feed'],
    queryFn: () => api.get('/correction-requests/feed?limit=20').then((r) => r.data),
    enabled: !!accessToken,
  })

  if (!accessToken) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">첨삭 피드</h1>
            <p className="text-sm text-gray-500 mt-0.5">교정해서 크레딧 버세요</p>
          </div>
          <button
            onClick={() => router.push('/request')}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
          >
            요청하기
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && (!requests || requests.length === 0) && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">현재 내 언어 능력으로 교정할 수 있는 요청이 없습니다</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {requests?.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-200 transition-colors cursor-pointer"
              onClick={() => router.push(`/correct/${req.id}`)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                    {LANG_LABELS[req.targetLanguage] ?? req.targetLanguage}
                  </span>
                  {req.type === 'AUDIO' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
                      🎙 음성
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-green-600">{rewardLabel(req)} 크레딧</span>
                  <span className="text-xs text-gray-400">{timeAgo(req.createdAt)}</span>
                </div>
              </div>

              {req.type === 'TEXT' ? (
                <p className="text-sm text-gray-800 line-clamp-3 mb-3">{req.contentText}</p>
              ) : (
                <p className="text-sm text-gray-400 italic mb-3">🎙 음성 교정 요청 — 재생해서 확인하세요</p>
              )}

              {req.feedbackGoals && req.feedbackGoals.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {req.feedbackGoals.map((g) => (
                    <span key={g} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {req.context && (
                <p className="text-xs text-gray-400 mt-2 italic">&quot;{req.context}&quot;</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
