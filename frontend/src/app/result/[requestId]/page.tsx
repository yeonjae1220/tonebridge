'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { Correction, CorrectionRequest, StudySession } from '@/types'
import { useWaveSurfer } from '@/hooks/useWaveSurfer'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useI18n } from '@/i18n/I18nProvider'
import { localizedLabel } from '@/lib/localizedLabels'

const STATUS_MAP: Record<string, { key: 'result.waiting' | 'result.approved' | 'result.rejected'; cls: string }> = {
  SUBMITTED: { key: 'result.waiting', cls: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { key: 'result.approved', cls: 'bg-green-100 text-green-700' },
  REJECTED: { key: 'result.rejected', cls: 'bg-red-100 text-red-700' },
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
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-indigo-600">{t('common.audio')}</p>
      <div ref={containerRef} className="w-full min-h-[48px] bg-indigo-50 rounded-xl overflow-hidden" />
      <div className="flex items-center justify-between">
        <button
          onClick={ws.togglePlay}
          disabled={!ws.ready}
          className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium disabled:opacity-40 hover:bg-indigo-600 transition-colors"
        >
          {ws.playing ? `⏸ ${t('common.pause')}` : `▶ ${t('common.play')}`}
        </button>
        <span className="text-xs text-gray-400 font-mono">
          {formatTime(ws.currentTime)} / {formatTime(ws.duration)}
        </span>
      </div>
    </div>
  )
}

function AudioCorrectionDetail({ correction }: { correction: Correction }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4">
      {/* Scores */}
      {(correction.pronunciationScore || correction.intonationScore || correction.fluencyScore) && (
        <div className="grid grid-cols-3 gap-3">
          {correction.pronunciationScore != null && (
            <div className="text-center bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-500 mb-1">{t('goal.pronunciation')}</p>
              <p className="text-xl font-bold text-blue-700">
                {correction.pronunciationScore}<span className="text-xs text-blue-400">/10</span>
              </p>
            </div>
          )}
          {correction.intonationScore != null && (
            <div className="text-center bg-purple-50 rounded-xl p-3">
              <p className="text-xs text-purple-500 mb-1">{t('goal.intonation')}</p>
              <p className="text-xl font-bold text-purple-700">
                {correction.intonationScore}<span className="text-xs text-purple-400">/10</span>
              </p>
            </div>
          )}
          {correction.fluencyScore != null && (
            <div className="text-center bg-green-50 rounded-xl p-3">
              <p className="text-xs text-green-500 mb-1">{t('goal.naturalness')}</p>
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
          <p className="text-xs font-semibold text-gray-500">{t('result.explanation')}</p>
          {correction.timestampComments.map((tc, i) => (
            <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
              <span className="text-xs font-mono text-indigo-500 shrink-0 mt-0.5">{formatTime(tc.start)}</span>
              <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full shrink-0">{localizedLabel(tc.category, t)}</span>
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
  const { data: currentUser } = useCurrentUser()
  const { t } = useI18n()
  const sseRef = useRef<EventSource | null>(null)
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null)
  const [editingRequest, setEditingRequest] = useState<CorrectionRequest | null>(null)
  const [editingCorrection, setEditingCorrection] = useState<Correction | null>(null)
  const [savingCorrection, setSavingCorrection] = useState<Correction | null>(null)
  const [likingId, setLikingId] = useState<string | null>(null)
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

  const { data: sessions = [] } = useQuery<StudySession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions').then((r) => r.data),
    enabled: !!accessToken,
  })

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

  const acceptMutation = useMutation({
    mutationFn: (correctionId: string) => api.post(`/corrections/${correctionId}/accept`),
    onSuccess: () => {
      refetch()
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
    },
  })

  const likeMutation = useMutation({
    mutationFn: (correctionId: string) => {
      setLikingId(correctionId)
      return api.post(`/corrections/${correctionId}/like`)
    },
    onSuccess: () => refetch(),
    onSettled: () => setLikingId(null),
  })

  const deleteCorrectionMutation = useMutation({
    mutationFn: (correctionId: string) => api.delete(`/corrections/${correctionId}`),
    onSuccess: () => refetch(),
  })

  const updateCorrectionMutation = useMutation({
    mutationFn: (correction: Correction) => api.patch(`/corrections/${correction.id}`, {
      correctedText: correction.correctedText,
      explanation: correction.explanation,
      tags: correction.tags,
      timestampComments: correction.timestampComments ?? [],
      pronunciationScore: correction.pronunciationScore,
      intonationScore: correction.intonationScore,
      fluencyScore: correction.fluencyScore,
      referenceAudioUrl: correction.referenceAudioUrl,
    }),
    onSuccess: () => refetch(),
  })

  const updateRequestMutation = useMutation({
    mutationFn: (payload: CorrectionRequest) => api.patch(`/correction-requests/${payload.id}`, {
      targetLanguage: payload.targetLanguage,
      targetVariant: payload.targetVariant,
      contentText: payload.contentText,
      context: payload.context,
      feedbackGoals: payload.feedbackGoals,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-requests'] }),
  })

  const createCardMutation = useMutation({
    mutationFn: (payload: { sessionId: string; phrase: string; context: string | null; tags: string[] }) =>
      api.post(`/sessions/${payload.sessionId}/cards`, {
        phrase: payload.phrase,
        context: payload.context,
        tags: payload.tags,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', variables.sessionId, 'cards'] })
      setSavingCorrection(null)
    },
  })

  const deleteRequestMutation = useMutation({
    mutationFn: () => api.delete(`/correction-requests/${requestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      router.push('/feed')
    },
  })

  if (!accessToken) return null

  const isAudio = request?.type === 'AUDIO'

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/feed')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <h1 className="text-xl font-bold text-gray-900">{t('result.title')}</h1>
        </div>

        {/* Original */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-amber-600">{t('result.original')}</p>
            {isAudio && (
              <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-700 rounded-full">{t('common.audio')}</span>
            )}
            {request && (
              <div className="ml-auto flex gap-2">
                {request.status === 'PENDING' && (
                  <button
                    onClick={() => setEditingRequest(request)}
                    className="text-xs text-amber-700 hover:text-amber-900"
                  >
                    {t('common.edit')}
                  </button>
                )}
                {request.status === 'PENDING' && (
                  <button
                    onClick={() => {
                      if (window.confirm(t('result.confirmDeleteRequest'))) {
                        deleteRequestMutation.mutate()
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
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
                  {ws.playing ? `⏸ ${t('common.pause')}` : `▶ ${t('common.play')}`}
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
          <div className="bg-surface rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-3xl mb-3">⏳</p>
            <p className="text-sm font-medium text-gray-700 mb-1">{t('result.pendingTitle')}</p>
            <p className="text-xs text-gray-400">{t('result.pendingSubtitle')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {corrections.map((correction) => {
              const statusInfo = STATUS_MAP[correction.status] ?? STATUS_MAP.SUBMITTED
              const canManage = currentUser?.id === correction.correctorId
              const isRequester = currentUser?.id === request?.requesterId
              const requestAccepted = !!request?.acceptedCorrectionId
              return (
                <div key={correction.id} className={`bg-surface rounded-2xl border overflow-hidden ${correction.isAccepted ? 'border-green-300 shadow-sm' : 'border-gray-100'}`}>
                  <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2 flex-wrap">
                    {correction.isAccepted ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                        {t('result.accepted')}
                      </span>
                    ) : (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.cls}`}>
                        {t(statusInfo.key)}
                      </span>
                    )}
                    {correction.isAi && (
                      <span className="text-xs text-purple-500 font-medium">{t('result.aiCorrection')}</span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => likeMutation.mutate(correction.id)}
                        disabled={likingId === correction.id}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${correction.likedByMe ? 'bg-pink-50 border-pink-300 text-pink-600' : 'border-gray-200 text-gray-500 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-600'}`}
                      >
                        ♥ {correction.likeCount > 0 ? correction.likeCount : t('result.like')}
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => setEditingCorrection(correction)}
                            className="text-xs text-gray-500 hover:text-blue-600"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(t('result.confirmDeleteCorrection'))) {
                                deleteCorrectionMutation.mutate(correction.id)
                              }
                            }}
                            className="text-xs text-gray-500 hover:text-red-600"
                          >
                            {t('common.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex flex-col gap-4">
                    {isAudio ? (
                      <AudioCorrectionDetail correction={correction} />
                    ) : (
                      correction.correctedText && (
                        <div>
                          <p className="text-xs font-semibold text-green-600 mb-1.5">{t('result.correctedText')}</p>
                          <p className="text-sm text-gray-800 bg-green-50 rounded-xl p-3">
                            {correction.correctedText}
                          </p>
                        </div>
                      )
                    )}

                    {correction.explanation && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-1.5">{t('result.explanation')}</p>
                        <p className="text-sm text-gray-700">{correction.explanation}</p>
                      </div>
                    )}

                    {correction.tags && correction.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {correction.tags.map((tag) => (
                          <span key={tag} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                            {localizedLabel(tag, t)}
                          </span>
                        ))}
                      </div>
                    )}

                    {correction.status !== 'REJECTED' && (
                      <div className="border-t border-gray-50 pt-4 flex flex-col gap-3">
                        {isRequester && !requestAccepted && !correction.isAccepted && (
                          <button
                            onClick={() => {
                              if (window.confirm(t('result.confirmAccept'))) {
                                acceptMutation.mutate(correction.id)
                              }
                            }}
                            disabled={acceptMutation.isPending}
                            className="w-full py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-40"
                          >
                            {t('result.accept')}
                          </button>
                        )}
                        <button
                          onClick={() => setSavingCorrection(correction)}
                          className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
                        >
                          {t('result.saveCard')}
                        </button>
                        <p className="text-xs text-gray-500 mb-0">{t('result.helpfulQuestion')}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              rateMutation.mutate({ correctionId: correction.id, helpful: true })
                            }
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm hover:bg-green-50 hover:border-green-300 transition-colors"
                          >
                            👍 {t('result.helpful')}
                          </button>
                          <button
                            onClick={() =>
                              rateMutation.mutate({ correctionId: correction.id, helpful: false })
                            }
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm hover:bg-red-50 hover:border-red-300 transition-colors"
                          >
                            👎 {t('result.notHelpful')}
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
      {editingRequest && (
        <RequestEditSheet
          request={editingRequest}
          isAudio={editingRequest.type === 'AUDIO'}
          pending={updateRequestMutation.isPending}
          onClose={() => setEditingRequest(null)}
          onSubmit={(payload) => {
            updateRequestMutation.mutate({ ...editingRequest, ...payload }, {
              onSuccess: () => setEditingRequest(null),
            })
          }}
        />
      )}
      {editingCorrection && (
        <CorrectionEditSheet
          correction={editingCorrection}
          isAudio={isAudio}
          pending={updateCorrectionMutation.isPending}
          onClose={() => setEditingCorrection(null)}
          onSubmit={(payload) => {
            updateCorrectionMutation.mutate({ ...editingCorrection, ...payload }, {
              onSuccess: () => setEditingCorrection(null),
            })
          }}
        />
      )}
      {savingCorrection && request && (
        <SaveCardSheet
          correction={savingCorrection}
          request={request}
          sessions={sessions.filter((s) => s.status === 'ACTIVE')}
          pending={createCardMutation.isPending}
          onClose={() => setSavingCorrection(null)}
          onSubmit={(payload) => createCardMutation.mutate(payload)}
          onStudy={() => router.push('/study')}
        />
      )}
    </main>
  )
}

function RequestEditSheet({
  request,
  isAudio,
  pending,
  onClose,
  onSubmit,
}: {
  request: CorrectionRequest
  isAudio: boolean
  pending: boolean
  onClose: () => void
  onSubmit: (payload: Partial<CorrectionRequest>) => void
}) {
  const [contentText, setContentText] = useState(request.contentText ?? '')
  const [context, setContext] = useState(request.context ?? '')
  const { t } = useI18n()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      contentText: isAudio ? request.contentText : contentText.trim(),
      context: context.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center px-4 pb-4">
      <form onSubmit={submit} className="w-full max-w-lg bg-surface rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <SheetHeader title={t('common.edit')} onClose={onClose} />
        {!isAudio && (
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        )}
        <input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder={t('request.context')}
        />
        <button type="submit" disabled={pending} className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold disabled:opacity-40">
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </div>
  )
}

function CorrectionEditSheet({
  correction,
  isAudio,
  pending,
  onClose,
  onSubmit,
}: {
  correction: Correction
  isAudio: boolean
  pending: boolean
  onClose: () => void
  onSubmit: (payload: Partial<Correction>) => void
}) {
  const [correctedText, setCorrectedText] = useState(correction.correctedText ?? '')
  const [explanation, setExplanation] = useState(correction.explanation ?? '')
  const { t } = useI18n()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!explanation.trim()) return
    onSubmit({
      correctedText: isAudio ? correction.correctedText : correctedText.trim(),
      explanation: explanation.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center px-4 pb-4">
      <form onSubmit={submit} className="w-full max-w-lg bg-surface rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <SheetHeader title={t('common.edit')} onClose={onClose} />
        {!isAudio && (
          <textarea
            value={correctedText}
            onChange={(e) => setCorrectedText(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={t('result.correctedText')}
          />
        )}
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder={t('result.explanation')}
        />
        <button type="submit" disabled={pending || !explanation.trim()} className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold disabled:opacity-40">
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </div>
  )
}

function SaveCardSheet({
  correction,
  request,
  sessions,
  pending,
  onClose,
  onSubmit,
  onStudy,
}: {
  correction: Correction
  request: CorrectionRequest
  sessions: StudySession[]
  pending: boolean
  onClose: () => void
  onSubmit: (payload: { sessionId: string; phrase: string; context: string | null; tags: string[] }) => void
  onStudy: () => void
}) {
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '')
  const { t } = useI18n()
  const [phrase, setPhrase] = useState(correction.correctedText || request.contentText || request.context || t('result.audioCardDefault'))
  const [context, setContext] = useState(correction.explanation || request.context || '')

  useEffect(() => {
    if (!sessionId && sessions[0]?.id) {
      setSessionId(sessions[0].id)
    }
  }, [sessionId, sessions])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!sessionId || !phrase.trim()) return
    onSubmit({
      sessionId,
      phrase: phrase.trim(),
      context: context.trim() || null,
      tags: correction.tags?.length ? correction.tags : request.feedbackGoals,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center px-4 pb-4">
      <form onSubmit={submit} className="w-full max-w-lg bg-surface rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <SheetHeader title={t('result.saveCard')} onClose={onClose} />
        {sessions.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-gray-700">{t('study.emptyTitle')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('study.emptySubtitle')}</p>
            <button type="button" onClick={onStudy} className="mt-4 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold">
              {t('study.startPractice')}
            </button>
          </div>
        ) : (
          <>
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-surface">
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>{session.title ?? t('study.practiceDefault')}</option>
              ))}
            </select>
            <textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none" />
            <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none" placeholder={t('study.cards.context')} />
            <button type="submit" disabled={pending || !sessionId || !phrase.trim()} className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40">
              {pending ? t('common.saving') : t('common.save')}
            </button>
          </>
        )}
      </form>
    </div>
  )
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">×</button>
    </div>
  )
}
