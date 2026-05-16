'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '일본어' },
  { code: 'zh', label: '중국어' },
  { code: 'en', label: '영어' },
  { code: 'es', label: '스페인어' },
  { code: 'fr', label: '프랑스어' },
  { code: 'de', label: '독일어' },
  { code: 'pt', label: '포르투갈어' },
]

type Step = 'native' | 'fluent' | 'learning'

export default function OnboardingPage() {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)

  // 로그인 안 된 상태면 로그인 페이지로
  if (!accessToken && typeof window !== 'undefined') {
    router.replace('/login')
    return null
  }

  const [step, setStep] = useState<Step>('native')
  const [nativeLanguage, setNativeLanguage] = useState('')
  const [fluentLanguages, setFluentLanguages] = useState<string[]>([])
  const [learningLanguages, setLearningLanguages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleMulti = (lang: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(lang) ? list.filter((l) => l !== lang) : [...list, lang])
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.patch('/users/me/onboarding', { nativeLanguage, fluentLanguages, learningLanguages })
      router.replace('/feed')
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  const stepIndex = ['native', 'fluent', 'learning'].indexOf(step)

  const steps: Record<Step, {
    title: string
    subtitle: string
    content: React.ReactNode
    canNext: boolean
    onNext: () => void
  }> = {
    native: {
      title: '모국어가 무엇인가요?',
      subtitle: '가장 능숙하게 말할 수 있는 언어',
      content: (
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setNativeLanguage(l.code)}
              className={`py-4 rounded-xl border-2 font-medium transition-all ${
                nativeLanguage === l.code
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      ),
      canNext: !!nativeLanguage,
      onNext: () => setStep('fluent'),
    },
    fluent: {
      title: '구사할 수 있는 언어는?',
      subtitle: '다른 사람의 언어를 교정해줄 수 있는 언어 (복수 선택)',
      content: (
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.filter((l) => l.code !== nativeLanguage).map((l) => (
            <button
              key={l.code}
              onClick={() => toggleMulti(l.code, fluentLanguages, setFluentLanguages)}
              className={`py-4 rounded-xl border-2 font-medium transition-all ${
                fluentLanguages.includes(l.code)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      ),
      canNext: true,
      onNext: () => setStep('learning'),
    },
    learning: {
      title: '배우고 있는 언어는?',
      subtitle: '교정을 받고 싶은 언어 (복수 선택)',
      content: (
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.filter((l) => l.code !== nativeLanguage).map((l) => (
            <button
              key={l.code}
              onClick={() => toggleMulti(l.code, learningLanguages, setLearningLanguages)}
              className={`py-4 rounded-xl border-2 font-medium transition-all ${
                learningLanguages.includes(l.code)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      ),
      canNext: learningLanguages.length > 0,
      onNext: handleSubmit,
    },
  }

  const current = steps[step]

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md flex flex-col gap-8">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900">{current.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{current.subtitle}</p>
        </div>

        {current.content}

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          onClick={current.onNext}
          disabled={!current.canNext || loading}
          className="w-full py-3.5 rounded-xl bg-blue-500 text-white font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors"
        >
          {step === 'learning' ? (loading ? '저장 중...' : '시작하기') : '다음'}
        </button>
      </div>
    </main>
  )
}
