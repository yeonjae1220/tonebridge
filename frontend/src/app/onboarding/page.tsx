'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { LanguagePicker } from '@/components/language-picker/LanguagePicker'

type Step = 'native' | 'fluent' | 'learning'

export default function OnboardingPage() {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)

  const [step, setStep] = useState<Step>('native')
  const [nativeLanguage, setNativeLanguage] = useState('')
  const [fluentLanguages, setFluentLanguages] = useState<string[]>([])
  const [learningLanguages, setLearningLanguages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

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
        <LanguagePicker
          value={nativeLanguage}
          onLanguageChange={setNativeLanguage}
          showVariantPicker={false}
        />
      ),
      canNext: !!nativeLanguage,
      onNext: () => setStep('fluent'),
    },
    fluent: {
      title: '구사할 수 있는 언어는?',
      subtitle: '다른 사람의 언어를 교정해줄 수 있는 언어 (복수 선택)',
      content: (
        <LanguagePicker
          multiSelect
          value={fluentLanguages}
          onLanguageChange={setFluentLanguages}
          excludeCodes={[nativeLanguage]}
        />
      ),
      canNext: true,
      onNext: () => setStep('learning'),
    },
    learning: {
      title: '배우고 있는 언어는?',
      subtitle: '교정을 받고 싶은 언어 (복수 선택)',
      content: (
        <LanguagePicker
          multiSelect
          value={learningLanguages}
          onLanguageChange={setLearningLanguages}
          excludeCodes={[nativeLanguage]}
        />
      ),
      canNext: learningLanguages.length > 0,
      onNext: handleSubmit,
    },
  }

  const current = steps[step]

  if (!accessToken) return null

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
