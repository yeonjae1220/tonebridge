'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { useI18n } from '@/i18n/I18nProvider'

function AuthCallbackInner() {
  const router = useRouter()
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const { t } = useI18n()

  useEffect(() => {
    // 백엔드는 항상 URL 프래그먼트(#token=...)로 access token을 전달
    const params = new URLSearchParams(window.location.hash.slice(1))
    const token = params.get('token')

    if (!token) {
      router.replace('/login?error=missing_token')
      return
    }

    // 최소한의 JWT 형식 검증 (Base64URL 세그먼트 3개)
    const isJwt = (s: string) => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(s)
    if (!isJwt(token)) {
      router.replace('/login?error=invalid_token_format')
      return
    }

    // /로 시작하고 //가 아닌 경우만 허용 — open redirect 방지
    const isSafeRedirect = (path: string) => /^\/(?!\/)/.test(path)

    setAccessToken(token)

    const explicitRedirect = sessionStorage.getItem('auth_redirect')
    sessionStorage.removeItem('auth_redirect')

    if (explicitRedirect && isSafeRedirect(explicitRedirect)) {
      router.replace(explicitRedirect)
      return
    }

    // 기존 사용자는 /feed로, 온보딩 미완료 사용자는 /onboarding으로 분기
    api.get<{ onboardingCompleted: boolean }>('/users/me')
      .then(({ data }) => {
        router.replace(data.onboardingCompleted ? '/study' : '/onboarding')
      })
      .catch(() => {
        router.replace('/onboarding')
      })
  }, [router, setAccessToken])

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm animate-pulse">{t('auth.loading')}</p>
    </main>
  )
}

export default function AuthCallbackPage() {
  const { t } = useI18n()
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm animate-pulse">{t('auth.loading')}</p>
      </main>
    }>
      <AuthCallbackInner />
    </Suspense>
  )
}
