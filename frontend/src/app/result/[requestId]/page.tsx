'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { Correction, CorrectionRequest } from '@/types'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: '검토 중', cls: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: '승인됨', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: '반려됨', cls: 'bg-red-100 text-red-700' },
}

export default function ResultPage() {
  const router = useRouter()
  const params = useParams()
  const requestId = params.requestId as string
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()
  const sseRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: myRequests } = useQuery<CorrectionRequest[]>({
    queryKey: ['my-requests'],
    queryFn: () => api.get('/correction-requests/mine').then((r) => r.data),
    enabled: !!accessToken,
  })

  const request = myRequests?.find((r) => r.id === requestId)

  const { data: corrections, refetch } = useQuery<Correction[]>({
    queryKey: ['corrections', requestId],
    queryFn: () => api.get(`/corrections/request/${requestId}`).then((r) => r.data),
    enabled: !!accessToken,
  })

  // SSE — listen for correction-ready notifications
  useEffect(() => {
    if (!accessToken) return
    const es = new EventSource(`/api/sse/notifications?token=${accessToken}`)
    sseRef.current = es
    es.addEventListener('correction-ready', () => {
      refetch()
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
    })
    return () => es.close()
  }, [accessToken, refetch, queryClient])

  const rateMutation = useMutation({
    mutationFn: ({ correctionId, helpful }: { correctionId: string; helpful: boolean }) =>
      api.post(`/corrections/${correctionId}/rate`, { helpful }),
    onSuccess: () => refetch(),
  })

  if (!accessToken) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/feed')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <h1 className="text-xl font-bold text-gray-900">첨삭 결과</h1>
        </div>

        {/* Original */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <p className="text-xs font-semibold text-amber-600 mb-2">내 원문</p>
          <p className="text-sm text-gray-800">{request?.contentText ?? '...'}</p>
        </div>

        {/* Corrections */}
        {!corrections || corrections.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-3xl mb-3">⏳</p>
            <p className="text-sm font-medium text-gray-700 mb-1">첨삭 대기 중</p>
            <p className="text-xs text-gray-400">원어민이 첨삭하면 알림이 옵니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {corrections.map((correction) => {
              const statusInfo = STATUS_MAP[correction.status] ?? STATUS_MAP.SUBMITTED
              return (
                <div key={correction.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                    {correction.isAi && (
                      <span className="text-xs text-purple-500 font-medium">AI 첨삭</span>
                    )}
                  </div>

                  <div className="p-5 flex flex-col gap-4">
                    {/* Corrected */}
                    <div>
                      <p className="text-xs font-semibold text-green-600 mb-1.5">수정 문장</p>
                      <p className="text-sm text-gray-800 bg-green-50 rounded-xl p-3">
                        {correction.correctedText}
                      </p>
                    </div>

                    {/* Explanation */}
                    {correction.explanation && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-1.5">설명</p>
                        <p className="text-sm text-gray-700">{correction.explanation}</p>
                      </div>
                    )}

                    {/* Tags */}
                    {correction.tags && correction.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {correction.tags.map((tag) => (
                          <span key={tag} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Rating */}
                    {correction.status !== 'REJECTED' && (
                      <div className="border-t border-gray-50 pt-4">
                        <p className="text-xs text-gray-500 mb-2">이 첨삭이 도움이 됐나요?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              rateMutation.mutate({ correctionId: correction.id, helpful: true })
                            }
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm hover:bg-green-50 hover:border-green-300 transition-colors"
                          >
                            👍 도움됨
                          </button>
                          <button
                            onClick={() =>
                              rateMutation.mutate({ correctionId: correction.id, helpful: false })
                            }
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm hover:bg-red-50 hover:border-red-300 transition-colors"
                          >
                            👎 별로
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
