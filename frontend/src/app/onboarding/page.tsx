'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { LanguagePicker } from '@/components/language-picker/LanguagePicker'

type Step = 'nickname' | 'native' | 'fluent' | 'learning'

const STEP_ORDER: Step[] = ['nickname', 'native', 'fluent', 'learning']

export default function OnboardingPage() {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)

  const [step, setStep] = useState<Step>('nickname')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [nativeLanguage, setNativeLanguage] = useState('')
  const [fluentLanguages, setFluentLanguages] = useState<string[]>([])
  const [learningLanguages, setLearningLanguages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const validateUsername = (value: string) => {
    if (value && !/^[a-zA-Z0-9_]{2,20}$/.test(value)) {
      return '닉네임은 2~20자의 영문, 숫자, 언더스코어만 사용할 수 있습니다.'
    }
    return null
  }

  const handleNicknameNext = () => {
    if (username) {
      const err = validateUsername(username)
      if (err) { setUsernameError(err); return }
    }
    setUsernameError(null)
    setStep('native')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.patch('/users/me/onboarding', {
        ...(username ? { username } : {}),
        nativeLanguage,
        fluentLanguages,
        learningLanguages,
      })
      router.replace('/feed')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        setError('이미 사용 중인 닉네임입니다. 첫 단계로 돌아가 닉네임을 바꿔주세요.')
      } else {
        setError('저장에 실패했습니다. 다시 시도해주세요.')
      }
      setLoading(false)
    }
  }

  const stepIndex = STEP_ORDER.indexOf(step)

  const steps: Record<Step, {
    title: string
    subtitle: string
    content: React.ReactNode
    canNext: boolean
    onNext: () => void
    nextLabel?: string
  }> = {
    nickname: {
      title: '닉네임을 설정해주세요',
      subtitle: '선택 사항이에요. 나중에 프로필에서 변경할 수 있어요.',
      content: (
        <div className="flex flex-col gap-2">
          <label htmlFor="onboarding-username" className="sr-only">닉네임</label>
          <input
            id="onboarding-username"
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setUsernameError(null) }}
            maxLength={20}
            placeholder="닉네임 (영문, 숫자, _ 2~20자)"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
          />
          {usernameError && <p className="text-xs text-red-500">{usernameError}</p>}
          <p className="text-xs text-gray-400">설정하지 않으면 임시 닉네임이 자동 부여됩니다.</p>
        </div>
      ),
      canNext: true,
      onNext: handleNicknameNext,
    },
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
      nextLabel: loading ? '저장 중...' : '시작하기',
    },
  }

  const current = steps[step]

  if (!accessToken) return null

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md flex flex-col gap-8">
        <div className="flex gap-2">
          {STEP_ORDER.map((_, i) => (
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
          {current.nextLabel ?? '다음'}
        </button>
      </div>
    </main>
  )
}
