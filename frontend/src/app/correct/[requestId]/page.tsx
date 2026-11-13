'use client'

import Link from 'next/link'
import { QueryError } from '@/components/ui/QueryError'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { CorrectionRequest, TimestampComment } from '@/types'

type TimestampCommentWithId = TimestampComment & { id: string }
import { useWaveSurfer } from '@/hooks/useWaveSurfer'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { RecorderErrorMessage } from '@/components/recorder/RecorderModal'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { usePresignedDownloadUrl } from '@/hooks/usePresignedDownloadUrl'
import { useI18n } from '@/i18n/I18nProvider'
import { AudioLoadFailed } from '@/components/audio/AudioLoadFailed'
import { formatMessage } from '@/i18n/messages'
import { localizedLabel } from '@/lib/localizedLabels'
import { captureAccountGuard } from '@/lib/validationDiagnostics'
import { getApiErrorMessage } from '@/lib/apiError'

const COMMON_TAGS = [
  { key: 'goal.grammar', value: '문법' },
  { key: 'goal.naturalness', value: '자연스러움' },
  { key: 'correct.tag.native', value: '원어민 표현' },
  { key: 'goal.pronunciation', value: '발음' },
  { key: 'goal.intonation', value: '억양' },
  { key: 'correct.tag.formal', value: '포멀' },
  { key: 'goal.casual', value: '캐주얼' },
] as const
const TIMESTAMP_CATEGORIES = [
  { key: 'goal.pronunciation', value: '발음' },
  { key: 'goal.intonation', value: '억양' },
  { key: 'correct.category.speed', value: '속도' },
  { key: 'correct.category.stress', value: '강세' },
  { key: 'correct.category.liaison', value: '연음' },
] as const

function ScoreSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-bold text-blue-600">{value}/10</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
    </div>
  )
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function CorrectPage() {
  const params = useParams()
  const generation = useAuthStore(s => s.sessionGeneration)
  return <CorrectionEditor key={`${generation}:${params.requestId}`} requestId={params.requestId as string} />
}

function CorrectionEditor({ requestId }: { requestId: string }) {
  const router = useRouter()
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const uploadedReference = useRef<{ blob: Blob; key: string } | null>(null)
  const { accessToken } = useAuthStore()
  const { t } = useI18n()

  const [correctedText, setCorrectedText] = useState('')
  const [explanation, setExplanation] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [error, setError] = useState('')

  const [timestampComments, setTimestampComments] = useState<TimestampCommentWithId[]>([])
  const [pendingComment, setPendingComment] = useState('')
  const [pendingCategory, setPendingCategory] = useState<string>(TIMESTAMP_CATEGORIES[0].value)
  const [pronunciationScore, setPronunciationScore] = useState(5)
  const [intonationScore, setIntonationScore] = useState(5)
  const [fluencyScore, setFluencyScore] = useState(5)

  const waveContainerRef = useRef<HTMLDivElement>(null)

  const refRecorder = useAudioRecorder(`correction-reference:${requestId}`)
  const { upload: uploadRef, uploading: uploadingRef } = usePresignedUpload()

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  // 단건 조회 — 예전엔 피드 최신 50건에서 id 로 찾아서, 그보다 오래된 요청은 '...' 로만 남았다.
  const requestQuery = useQuery<CorrectionRequest>({
    queryKey: ['correction-request', requestId],
    queryFn: () => api.get<CorrectionRequest>(`/correction-requests/${requestId}`).then((r) => r.data),
    enabled: !!accessToken,
  })

  const request = requestQuery.data

  const originalAudio = usePresignedDownloadUrl(!requestQuery.isError && request?.type === 'AUDIO' ? request.audioUrl : null)
  const ws = useWaveSurfer(waveContainerRef, originalAudio.url)

  const mutation = useMutation({
    mutationFn: async () => {
      const requireSameAccount = captureAccountGuard()
      const savedBlob = refRecorder.audioBlob
      let referenceAudioUrl: string | undefined
      if (request?.type === 'AUDIO' && refRecorder.state === 'stopped') {
        const file = refRecorder.getFile(`ref_${Date.now()}.webm`)
        if (file && savedBlob) {
          if (uploadedReference.current?.blob === savedBlob) referenceAudioUrl = uploadedReference.current.key
          else {
            referenceAudioUrl = await uploadRef(file)
            uploadedReference.current = { blob: savedBlob, key: referenceAudioUrl }
          }
        }
      }

      requireSameAccount()
      await api.post('/corrections', {
        requestId,
        correctedText: correctedText || undefined,
        explanation,
        tags: selectedTags,
        ...(request?.type === 'AUDIO' && {
          timestampComments: timestampComments.map(({ id: _id, ...tc }) => tc),
          pronunciationScore,
          intonationScore,
          fluencyScore,
          referenceAudioUrl,
        }),
      })
      requireSameAccount()
      return savedBlob
    },
    onSuccess: savedBlob => {
      if (!mounted.current) return
      refRecorder.clearSaved(savedBlob)
      router.push('/community')
    },
    onMutate: () => setError(''),
    onError: (e: unknown) => setError(getApiErrorMessage(e, t('correct.submitFailed'))),
  })

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const addTimestampComment = () => {
    if (!pendingComment.trim() || !ws.ready || mutation.isPending) return
    const start = ws.currentTime
    setTimestampComments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), start, end: start + 2, comment: pendingComment.trim(), category: pendingCategory },
    ])
    setPendingComment('')
  }

  const removeTimestampComment = (idx: number) => {
    setTimestampComments((prev) => prev.filter((_, i) => i !== idx))
  }

  const isAudio = request?.type === 'AUDIO'
  const recordingBusy = refRecorder.starting || refRecorder.state === 'recording' || refRecorder.state === 'processing'
  const isValid = !!request && !requestQuery.isError && explanation.trim().length >= 20 && !recordingBusy

  if (!accessToken) return null
  if (requestQuery.isError || !request) return <main className="mx-auto max-w-lg space-y-5 px-4 py-8">
    <h1 className="text-xl font-bold">{t('correct.title')}</h1>
    {requestQuery.isError ? <QueryError retrying={requestQuery.isFetching} onRetry={() => void requestQuery.refetch()} /> : <p role="status">{t('common.loading')}</p>}
    <Link href="/community" className="block py-3 text-blue-600">{t('nav.feed')}</Link>
  </main>

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button aria-label={t('nav.feed')} onClick={() => router.push('/community')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('correct.title')}</h1>
          </div>
        </div>

        {/* Original */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-amber-600">{t('result.original')}</p>
            {isAudio && (
              <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-700 rounded-full font-medium">{t('common.audio')}</span>
            )}
          </div>
          {isAudio ? (
            <div>
              <AudioLoadFailed failed={originalAudio.failed || ws.failed} onRetry={() => { originalAudio.retry(); ws.retry() }} />
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
          {request?.context && (
            <p className="text-xs text-amber-500 mt-2 italic">&quot;{request.context}&quot;</p>
          )}
          {request?.feedbackGoals && request.feedbackGoals.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {request.feedbackGoals.map((g) => (
                <span key={g} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full">{localizedLabel(g, t)}</span>
              ))}
            </div>
          )}
        </div>

        <fieldset disabled={mutation.isPending || uploadingRef} className="flex min-w-0 flex-col gap-5">
        {/* Timestamp comments */}
        {isAudio && (
          <div className="bg-surface rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
            <label className="text-sm font-semibold text-gray-700">{t('correct.timestampTitle')}</label>
            <p className="text-xs text-gray-400">{t('correct.timestampHelp')}</p>
            <div className="flex gap-2">
              <select
                aria-label={t('correct.timestampTitle')}
                value={pendingCategory}
                onChange={(e) => setPendingCategory(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {TIMESTAMP_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.key)}</option>
                ))}
              </select>
              <input
                aria-label={t('correct.commentPlaceholder')}
                value={pendingComment}
                onChange={(e) => setPendingComment(e.target.value)}
                placeholder={t('correct.commentPlaceholder')}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  if (e.key === 'Enter') { e.preventDefault(); addTimestampComment() }
                }}
                className="min-w-0 flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={addTimestampComment}
                disabled={!ws.ready}
                className="px-3 py-2 rounded-xl bg-action-primary text-white text-sm font-medium disabled:opacity-40 hover:bg-action-primary-hover transition-colors"
              >
                +
              </button>
            </div>
            {timestampComments.length > 0 && (
              <div className="flex flex-col gap-2">
                {timestampComments.map((tc, i) => (
                  <div key={tc.id} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                    <button
                      onClick={() => ws.seekTo(tc.start)}
                      className="text-xs font-mono text-blue-500 hover:text-blue-700 shrink-0 mt-0.5"
                    >
                      {formatTime(tc.start)}
                    </button>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full shrink-0">{localizedLabel(tc.category, t)}</span>
                    <span className="text-sm text-gray-700 flex-1">{tc.comment}</span>
                    <button onClick={() => removeTimestampComment(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scores */}
        {isAudio && (
          <div className="bg-surface rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
            <label className="text-sm font-semibold text-gray-700">{t('correct.scoreTitle')}</label>
            <ScoreSlider label={t('correct.pronunciationAccuracy')} value={pronunciationScore} onChange={setPronunciationScore} />
            <ScoreSlider label={t('correct.intonationNaturalness')} value={intonationScore} onChange={setIntonationScore} />
            <ScoreSlider label={t('correct.fluency')} value={fluencyScore} onChange={setFluencyScore} />
          </div>
        )}

        {/* Reference audio */}
        {isAudio && (
          <div className="bg-surface rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">{t('correct.referenceAudio')}</label>
            </div>
            <p className="text-xs text-gray-400">{t('correct.referenceHelp')}</p>
            <RecorderErrorMessage error={refRecorder.error} />
            {(refRecorder.starting || refRecorder.state === 'processing') && <p role="status" className="text-sm">{t('common.loading')}</p>}
            <div className="flex items-center gap-3">
              {refRecorder.state === 'idle' && (
                <button
                  disabled={refRecorder.starting || refRecorder.draftStatus === 'loading'}
                  onClick={() => void refRecorder.start()}
                  className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
                >
                  🎙 {t('correct.startRecording')}
                </button>
              )}
              {refRecorder.state === 'recording' && (
                <button
                  onClick={refRecorder.stop}
                  className="px-4 py-2 rounded-xl bg-action-record text-white text-sm font-medium animate-pulse"
                >
                  ⏹ {t('correct.recordingStop')}
                </button>
              )}
              {refRecorder.state === 'stopped' && refRecorder.audioUrl && (
                <div className="flex-1 flex gap-2 items-center">
                  <audio controls src={refRecorder.audioUrl} className="flex-1 h-8" />
                  <button onClick={() => { if (window.confirm(t('recording.discard'))) refRecorder.reset() }} className="text-xs text-gray-400 hover:text-gray-600">{t('correct.recordAgainShort')}</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Corrected text (TEXT only) */}
        {!isAudio && (
          <div className="bg-surface rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
            <label className="text-sm font-semibold text-gray-700">{t('result.correctedText')}</label>
            <textarea
              aria-label={t('result.correctedText')}
              value={correctedText}
              onChange={(e) => setCorrectedText(e.target.value)}
              placeholder={t('correct.correctedTextPlaceholder')}
              rows={4}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        {/* Explanation */}
        <div className="bg-surface rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">{t('result.explanation')}</label>
            <span className={`text-xs ${explanation.length >= 20 ? 'text-green-500' : 'text-gray-400'}`}>
              {explanation.length}/20 {t('correct.minimum')}
            </span>
          </div>
          <textarea
            aria-label={t('result.explanation')}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder={isAudio ? t('correct.explanationAudioPlaceholder') : t('correct.explanationTextPlaceholder')}
            rows={4}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Tags */}
        <div className="bg-surface rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
          <label className="text-sm font-semibold text-gray-700">{t('correct.tagsOptional')}</label>
          <div className="flex flex-wrap gap-2">
            {COMMON_TAGS.map((tag) => (
              <button
                key={tag.value}
                onClick={() => toggleTag(tag.value)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  selectedTags.includes(tag.value)
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-surface text-gray-500 border-gray-200 hover:border-blue-300'
                }`}
              >
                {t(tag.key)}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="text-red-500 text-sm px-1">{error}</p>}

        <button
          onClick={() => mutation.mutate()}
          disabled={!isValid || mutation.isPending || uploadingRef}
          className="w-full py-3.5 rounded-xl bg-action-primary text-white font-semibold disabled:opacity-40 hover:bg-action-primary-hover transition-colors"
        >
          {mutation.isPending || uploadingRef ? t('correct.submitting') : t('correct.submit')}
        </button>
        </fieldset>
      </div>
    </main>
  )
}
