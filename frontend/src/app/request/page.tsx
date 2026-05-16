'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

const FEEDBACK_GOALS = ['발음', '문법', '자연스러움', '억양', '캐주얼', '비즈니스']

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '일본어' },
  { code: 'zh', label: '중국어' },
  { code: 'en', label: '영어' },
  { code: 'es', label: '스페인어' },
  { code: 'fr', label: '프랑스어' },
]

export default function RequestPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const [targetLanguage, setTargetLanguage] = useState('')
  const [contentText, setContentText] = useState('')
  const [context, setContext] = useState('')
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [error, setError] = useState('')

  if (!accessToken) {
    router.replace('/login')
    return null
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/correction-requests', {
        targetLanguage,
        contentText,
        context,
        feedbackGoals: selectedGoals,
      }),
    onSuccess: () => router.push('/feed'),
    onError: (e: any) => setError(e.response?.data?.message || '요청 실패'),
  })

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    )
  }

  const CREDIT_COST = 5

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교정 요청</h1>
          <p className="text-sm text-gray-500 mt-1">
            원어민에게 텍스트를 교정 받으세요
          </p>
        </div>

        {/* Language */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
          <label className="text-sm font-semibold text-gray-700">교정 언어</label>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setTargetLanguage(lang.code)}
                className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                  targetLanguage === lang.code
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
          <label className="text-sm font-semibold text-gray-700">교정할 문장</label>
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="교정 받고 싶은 문장을 입력하세요..."
            rows={5}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <label className="text-sm font-semibold text-gray-700 mt-1">문맥 (선택)</label>
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="예: 일본 회사에 이메일을 보낼 때..."
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Goals */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
          <label className="text-sm font-semibold text-gray-700">피드백 목표 (선택)</label>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_GOALS.map((goal) => (
              <button
                key={goal}
                onClick={() => toggleGoal(goal)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedGoals.includes(goal)
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                }`}
              >
                {goal}
              </button>
            ))}
          </div>
        </div>

        {/* Cost + submit */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">사용 크레딧</span>
            <span className="text-lg font-bold text-blue-600">-{CREDIT_COST}</span>
          </div>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={() => mutation.mutate()}
            disabled={!targetLanguage || !contentText.trim() || mutation.isPending}
            className="w-full py-3 rounded-xl bg-blue-500 text-white font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors"
          >
            {mutation.isPending ? '요청 중...' : '교정 요청하기'}
          </button>
        </div>
      </div>
    </main>
  )
}
