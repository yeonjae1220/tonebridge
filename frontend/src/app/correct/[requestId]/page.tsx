'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { CorrectionRequest, TimestampComment } from '@/types'

type TimestampCommentWithId = TimestampComment & { id: string }
import { useWaveSurfer } from '@/hooks/useWaveSurfer'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'

const COMMON_TAGS = ['문법', '자연스러움', '원어민 표현', '발음', '억양', '포멀', '캐주얼']
const TIMESTAMP_CATEGORIES = ['발음', '억양', '속도', '강세', '연음']

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
  const router = useRouter()
  const params = useParams()
  const requestId = params.requestId as string
  const { accessToken } = useAuthStore()

  const [correctedText, setCorrectedText] = useState('')
  const [explanation, setExplanation] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [error, setError] = useState('')

  const [timestampComments, setTimestampComments] = useState<TimestampCommentWithId[]>([])
  const [pendingComment, setPendingComment] = useState('')
  const [pendingCategory, setPendingCategory] = useState(TIMESTAMP_CATEGORIES[0])
  const [pronunciationScore, setPronunciationScore] = useState(5)
  const [intonationScore, setIntonationScore] = useState(5)
  const [fluencyScore, setFluencyScore] = useState(5)
  const [audioDownloadUrl, setAudioDownloadUrl] = useState<string | null>(null)

  const waveContainerRef = useRef<HTMLDivElement>(null)
  const ws = useWaveSurfer(waveContainerRef, audioDownloadUrl)

  const refRecorder = useAudioRecorder()
  const { upload: uploadRef, uploading: uploadingRef } = usePresignedUpload()

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: requests } = useQuery<CorrectionRequest[]>({
    queryKey: ['correction-feed'],
    queryFn: () => api.get('/correction-requests/feed?limit=50').then((r) => r.data),
    enabled: !!accessToken,
  })

  const request = requests?.find((r) => r.id === requestId)

  useEffect(() => {
    if (request?.type === 'AUDIO' && request.audioUrl) {
      api
        .get<{ downloadUrl: string }>(`/storage/presigned-download?key=${encodeURIComponent(request.audioUrl)}`)
        .then((r) => setAudioDownloadUrl(r.data.downloadUrl))
    }
  }, [request])

  const mutation = useMutation({
    mutationFn: async () => {
      let referenceAudioUrl: string | undefined
      if (request?.type === 'AUDIO' && refRecorder.state === 'stopped') {
        const file = refRecorder.getFile(`ref_${Date.now()}.webm`)
        if (file) referenceAudioUrl = await uploadRef(file)
      }

      return api.post('/corrections', {
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
    },
    onSuccess: () => router.push('/feed'),
    onError: (e: unknown) => setError((e as AxiosError<{ message: string }>).response?.data?.message ?? '제출 실패'),
  })

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const addTimestampComment = () => {
    if (!pendingComment.trim()) return
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
  const isValid = explanation.trim().length >= 20
  const reward = isAudio ? (refRecorder.state === 'stopped' ? 12 : 8) : 4

  if (!accessToken) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">첨삭 작성</h1>
            <p className="text-xs text-gray-400 mt-0.5">완료 시 +{reward} 크레딧</p>
          </div>
        </div>

        {/* Original */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-amber-600">원문</p>
            {isAudio && (
              <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-700 rounded-full font-medium">음성</span>
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
          {request?.context && (
            <p className="text-xs text-amber-500 mt-2 italic">&quot;{request.context}&quot;</p>
          )}
          {request?.feedbackGoals && request.feedbackGoals.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {request.feedbackGoals.map((g) => (
                <span key={g} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full">{g}</span>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp comments */}
        {isAudio && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
            <label className="text-sm font-semibold text-gray-700">구간 코멘트</label>
            <p className="text-xs text-gray-400">재생 중 원하는 위치에서 코멘트를 추가하세요</p>
            <div className="flex gap-2">
              <select
                value={pendingCategory}
                onChange={(e) => setPendingCategory(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {TIMESTAMP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                value={pendingComment}
                onChange={(e) => setPendingComment(e.target.value)}
                placeholder="코멘트 입력..."
                onKeyDown={(e) => e.key === 'Enter' && addTimestampComment()}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={addTimestampComment}
                disabled={!ws.ready}
                className="px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-600 transition-colors"
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
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full shrink-0">{tc.category}</span>
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
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
            <label className="text-sm font-semibold text-gray-700">점수 평가</label>
            <ScoreSlider label="발음 정확도" value={pronunciationScore} onChange={setPronunciationScore} />
            <ScoreSlider label="억양 자연스러움" value={intonationScore} onChange={setIntonationScore} />
            <ScoreSlider label="이해 가능성" value={fluencyScore} onChange={setFluencyScore} />
          </div>
        )}

        {/* Reference audio */}
        {isAudio && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">원어민 재녹음 (선택)</label>
              <span className="text-xs text-green-600 font-medium">+4 추가 크레딧</span>
            </div>
            <p className="text-xs text-gray-400">직접 올바른 발음을 녹음해 보여주세요</p>
            <div className="flex items-center gap-3">
              {refRecorder.state === 'idle' && (
                <button
                  onClick={refRecorder.start}
                  className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
                >
                  🎙 녹음 시작
                </button>
              )}
              {refRecorder.state === 'recording' && (
                <button
                  onClick={refRecorder.stop}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium animate-pulse"
                >
                  ⏹ 중지
                </button>
              )}
              {refRecorder.state === 'stopped' && refRecorder.audioUrl && (
                <div className="flex-1 flex gap-2 items-center">
                  <audio controls src={refRecorder.audioUrl} className="flex-1 h-8" />
                  <button onClick={refRecorder.reset} className="text-xs text-gray-400 hover:text-gray-600">다시</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Corrected text (TEXT only) */}
        {!isAudio && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
            <label className="text-sm font-semibold text-gray-700">수정 문장</label>
            <textarea
              value={correctedText}
              onChange={(e) => setCorrectedText(e.target.value)}
              placeholder="자연스럽게 수정한 문장을 입력하세요..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        {/* Explanation */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">설명</label>
            <span className={`text-xs ${explanation.length >= 20 ? 'text-green-500' : 'text-gray-400'}`}>
              {explanation.length}/20 최소
            </span>
          </div>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder={isAudio ? '발음, 억양, 속도 등에 대한 피드백을 작성해주세요...' : '왜 어색한지, 어떻게 고쳐야 하는지 설명해주세요...'}
            rows={4}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Tags */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
          <label className="text-sm font-semibold text-gray-700">태그 (선택)</label>
          <div className="flex flex-wrap gap-2">
            {COMMON_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm px-1">{error}</p>}

        <button
          onClick={() => mutation.mutate()}
          disabled={!isValid || mutation.isPending || uploadingRef}
          className="w-full py-3.5 rounded-xl bg-blue-500 text-white font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors"
        >
          {mutation.isPending || uploadingRef ? '제출 중...' : '첨삭 제출하기'}
        </button>
      </div>
    </main>
  )
}
