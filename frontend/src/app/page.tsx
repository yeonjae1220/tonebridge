'use client'

import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'
import LandingPage from '@/components/landing/LandingPage'
import { useI18n } from '@/i18n/I18nProvider'

export default function HomePage() {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const { data: user, isLoading } = useCurrentUser()
  const { t } = useI18n()

  // accessToken은 복원됐지만 유저 정보를 아직 fetch 중 — 랜딩 페이지 플래시 방지
  if (accessToken && isLoading) return null
  if (!user) return <LandingPage />

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900">
            Tone<span className="text-blue-500">Bridge</span>
          </h1>
          <p className="text-lg text-gray-500 mt-3">
            {t('home.tagline')}
          </p>
        </div>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <div className="bg-surface rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
            <div className="text-left">
              <p className="text-sm text-gray-500">{t('home.myCredits')}</p>
              <p className="text-2xl font-bold text-blue-600">{user.credits}</p>
            </div>
            <button
              onClick={() => router.push('/wallet')}
              className="text-sm text-blue-500 hover:underline"
            >
              {t('home.history')} →
            </button>
          </div>
          <button
            onClick={() => router.push('/request')}
            className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
          >
            {t('home.requestCorrection')}
          </button>
          <button
            onClick={() => router.push('/feed')}
            className="w-full py-3.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            {t('home.earnCredits')}
          </button>
          <button
            onClick={() => router.push('/feed?tab=mine')}
            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            {t('home.myRequests')}
          </button>
        </div>
      </div>
    </main>
  )
}
