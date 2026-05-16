'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { Correction, CorrectionRequest } from '@/types'
import { useWaveSurfer } from '@/hooks/useWaveSurfer'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: '검토 중', cls: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: '승인됨', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: '반려됨', cls: 'bg-red-100 text-red-700' },
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function RefAudioPlayer({ audioKey }: { audioKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ downloadUrl: string }>(`/storage/presigned-download?key=${encodeURIComponent(audioKey)}`)
      .then((r) => setUrl(r.data.downloadUrl))
  }, [audioKey])

  const ws = useWaveSurfer(containerRef, url)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-indigo-600">원어민 재녹음</p>
      <div ref={containerRef} className="w-full min-h-[48px] bg-indigo-50 rounded-xl overflow-hidden" />
      <div className="flex items-center justify-between">
        <button
          onClick={ws.togglePlay}
          disabled={!ws.ready}
          className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium disabled:opacity-40 hover:bg-indigo-600 transition-colors"
        >
          {ws.playing ? '⏸ 일시정지' : '▶ 재생'}
        </button>
        <span className="text-xs text-gray-400 font-mono">
          {formatTime(ws.currentTime)} / {formatTime(ws.duration)}
        </span>
      </div>
    </div>
  )
}

function AudioCorrectionDetail({ correction }: { correction: Correction }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Scores */}
      {(correction.pronunciationScore || correction.intonationScore || correction.fluencyScore) && (
        <div className="grid grid-cols-3 gap-3">
          {correction.pronunciationScore != null && (
            <div className="text-center bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-500 mb-1">발음</p>
              <p className="text-xl font-bold text-blue-700">
                {correction.pronunciationScore}<span className="text-xs text-blue-400">/10</span>
              </p>
            </div>
          )}
          {correction.intonationScore != null && (
            <div className="text-center bg-purple-50 rounded-xl p-3">
              <p className="text-xs text-purple-500 mb-1">억양</p>
              <p className="text-xl font-bold text-purple-700">
                {correction.intonationScore}<span className="text-xs text-purple-400">/10</span>
              </p>
            </div>
          )}
          {correction.fluencyScore != null && (
            <div className="text-center bg-green-50 rounded-xl p-3">
              <p className="text-xs text-green-500 mb-1">이해도</p>
              <p className="text-xl font-bold text-green-700">
                {correction.fluencyScore}<span className="text-xs text-green-400">/10</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Timestamp comments */}
      {correction.timestampComments && correction.timestampComments.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500">구간 코멘트</p>
          {correction.timestampComments.map((tc, i) => (
            <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
              <span className="text-xs font-mono text-indigo-500 shrink-0 mt-0.5">{formatTime(tc.start)}</span>
              <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full shrink-0">{tc.category}</span>
              <span className="text-sm text-gray-700 flex-1">{tc.comment}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reference audio */}
      {correction.referenceAudioUrl && (
        <RefAudioPlayer audioKey={correction.referenceAudioUrl} />
      )}
    </div>
  )
}

export default function ResultPage() {
  const router = useRouter()
  const params = useParams()
  const requestId = params.requestId as string
  const { accessToken } = useAuthStore()
  const queryClient = useQueryClient()
  const sseRef = useRef<EventSource | null>(null)
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null)
  const waveContainerRef = useRef<HTMLDivElement>(null)
  const ws = useWaveSurfer(waveContainerRef, originalAudioUrl)

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: myRequests } = useQuery<CorrectionRequest[]>({
    queryKey: ['my-requests'],
    queryFn: () => api.get('/correction-requests/mine').then((r) => r.data),
    enabled: !!accessToken,
  })

  const request = myRequests?.find((r) => r.id === requestId)

  useEffect(() => {
    if (request?.type === 'AUDIO' && request.audioUrl) {
      api
        .get<{ downloadUrl: string }>(`/storage/presigned-download?key=${encodeURIComponent(request.audioUrl)}`)
        .then((r) => setOriginalAudioUrl(r.data.downloadUrl))
    }
  }, [request])

  const { data: corrections, refetch } = useQuery<Correction[]>({
    queryKey: ['corrections', requestId],
    queryFn: () => api.get(`/corrections/request/${requestId}`).then((r) => r.data),
    enabled: !!accessToken,
  })

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

  const isAudio = request?.type === 'AUDIO'

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/feed')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <h1 className="text-xl font-bold text-gray-900">첨삭 결과</h1>
        </div>

        {/* Original */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-amber-600">내 원문</p>
            {isAudio && (
              <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-700 rounded-full">음성</span>
            )}
          </div>
          {isAudio ? (
            <div>
              <div ref={waveContainerRef} className="w-full min-h-[64px] bg-amber-100 rounded-xl overflow-hidden" />
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={ws.togglePlay}
                  disabled={!ws.ready}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-amber-600 transition-colors"
                >
                  {ws.playing ? '⏸ 일시정지' : '▶ 재생'}
                </button>
                <span className="text-xs text-amber-600 font-mono">
                  {formatTime(ws.currentTime)} / {formatTime(ws.duration)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-800">{request?.contentText ?? '...'}</p>
          )}
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
                    {isAudio ? (
                      <AudioCorrectionDetail correction={correction} />
                    ) : (
                      correction.correctedText && (
                        <div>
                          <p className="text-xs font-semibold text-green-600 mb-1.5">수정 문장</p>
                          <p className="text-sm text-gray-800 bg-green-50 rounded-xl p-3">
                            {correction.correctedText}
                          </p>
                        </div>
                      )
                    )}

                    {correction.explanation && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-1.5">설명</p>
                        <p className="text-sm text-gray-700">{correction.explanation}</p>
                      </div>
                    )}

                    {correction.tags && correction.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {correction.tags.map((tag) => (
                          <span key={tag} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

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
