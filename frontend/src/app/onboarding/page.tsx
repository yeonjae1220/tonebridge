'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { consumePostAuthRedirect } from '@/lib/authNavigate'
import { LanguagePicker } from '@/components/language-picker/LanguagePicker'
import { useI18n } from '@/i18n/I18nProvider'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getApiErrorStatus } from '@/lib/apiError'

type Step = 'native' | 'learning'

const STEP_ORDER: Step[] = ['native', 'learning']

export default function OnboardingPage() {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const { language, t } = useI18n()

  const [step, setStep] = useState<Step>('native')
  const { data: currentUser } = useCurrentUser()
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
      return t('profile.nicknameInvalid')
    }
    return null
  }

  const handleSubmit = async () => {
    const validation = validateUsername(username)
    if (validation) { setUsernameError(validation); return }
    setLoading(true)
    setError(null)
    try {
      await api.patch('/users/me/onboarding', {
        ...(username ? { username } : {}),
        nativeLanguage,
        uiLanguage: language,
        fluentLanguages,
        learningLanguages,
      })
      router.replace(consumePostAuthRedirect())
    } catch (err: unknown) {
      const status = getApiErrorStatus(err)
      if (status !== 409) console.error('[onboarding] 프로필 저장 실패', err)
      if (status === 409) {
        setUsernameError(t('profile.nicknameTaken'))
        setError(t('profile.nicknameTaken'))
      } else {
        setError(t('profile.saveFailed'))
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
    native: {
      title: t('onboarding.native.title'),
      subtitle: t('onboarding.native.subtitle'),
      content: (
        <LanguagePicker
          value={nativeLanguage}
          onLanguageChange={(code) => {
            setNativeLanguage(code)
          }}
          showVariantPicker={false}
        />
      ),
      canNext: !!nativeLanguage,
      onNext: () => { setFluentLanguages((values) => values.filter((value) => value !== nativeLanguage)); setLearningLanguages((values) => values.filter((value) => value !== nativeLanguage)); setStep('learning') },
    },
    learning: {
      title: t('onboarding.learning.title'),
      subtitle: t('onboarding.learning.subtitle'),
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
      nextLabel: loading ? t('common.saving') : t('common.start'),
    },
  }

  const current = steps[step]

  if (!accessToken) return null

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-surface rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-md flex flex-col gap-6">
        <div className="flex gap-2">
          {STEP_ORDER.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-action-primary' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900">{current.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{current.subtitle}</p>
        </div>

        {current.content}
        {step === 'learning' && <details open={!!usernameError || undefined} className="rounded-xl border border-gray-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-600">{t('onboarding.optional')}</summary>
          <label className="mt-4 flex flex-col gap-2 text-sm">
            <span>{t('profile.nickname')}</span>
            <input id="onboarding-username" value={username} placeholder={currentUser?.username ?? t('onboarding.nickname.placeholder')} maxLength={20}
              onChange={(event) => { setUsername(event.target.value); setUsernameError(null) }} className="rounded-xl border border-gray-200 px-3 py-3" />
          </label>
          {usernameError && <p role="alert" className="mt-2 text-sm text-red-500">{usernameError}</p>}
          <p className="mt-4 mb-2 text-sm font-semibold">{t('onboarding.fluent.title')}</p>
          <LanguagePicker multiSelect value={fluentLanguages} onLanguageChange={setFluentLanguages} excludeCodes={[nativeLanguage]} />
        </details>}

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <div className="flex gap-3">
        {stepIndex > 0 && <button type="button" disabled={loading} onClick={() => { setError(null); setStep(STEP_ORDER[stepIndex - 1]) }}
          className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600">{t('common.back')}</button>}
        <button
          onClick={current.onNext}
          disabled={!current.canNext || loading}
          className="w-full py-3.5 rounded-xl bg-action-primary text-white font-semibold disabled:opacity-40 hover:bg-action-primary-hover transition-colors"
        >
          {current.nextLabel ?? t('common.next')}
        </button>
        </div>
      </div>
    </main>
  )
}
