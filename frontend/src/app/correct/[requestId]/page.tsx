'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { CorrectionRequest } from '@/types'

const COMMON_TAGS = ['문법', '자연스러움', '원어민 표현', '발음', '억양', '포멀', '캐주얼']

export default function CorrectPage() {
  const router = useRouter()
  const params = useParams()
  const requestId = params.requestId as string
  const { accessToken } = useAuthStore()

  const [correctedText, setCorrectedText] = useState('')
  const [explanation, setExplanation] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: requests } = useQuery<CorrectionRequest[]>({
    queryKey: ['correction-feed'],
    queryFn: () => api.get('/correction-requests/feed?limit=50').then((r) => r.data),
    enabled: !!accessToken,
  })

  const request = requests?.find((r) => r.id === requestId)

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/corrections', {
        requestId,
        correctedText,
        explanation,
        tags: selectedTags,
      }),
    onSuccess: () => router.push('/feed'),
    onError: (e: any) => setError(e.response?.data?.message || '제출 실패'),
  })

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const isValid = correctedText.trim().length > 0 && explanation.trim().length >= 20

  if (!accessToken) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">첨삭 작성</h1>
            <p className="text-xs text-gray-400 mt-0.5">완료 시 +4 크레딧</p>
          </div>
        </div>

        {/* Original text */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <p className="text-xs font-semibold text-amber-600 mb-2">원문</p>
          <p className="text-sm text-gray-800">{request?.contentText ?? '...'}</p>
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

        {/* Corrected text */}
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
            placeholder="왜 어색한지, 어떻게 고쳐야 하는지 설명해주세요..."
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
          disabled={!isValid || mutation.isPending}
          className="w-full py-3.5 rounded-xl bg-blue-500 text-white font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors"
        >
          {mutation.isPending ? '제출 중...' : '첨삭 제출하기'}
        </button>
      </div>
    </main>
  )
}
