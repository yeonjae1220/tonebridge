'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { PostAuthNavigation } from '@/components/auth/PostAuthNavigation'
import { useI18n } from '@/i18n/I18nProvider'

function AuthCallbackInner() {
  const router = useRouter()
  const beginSession = useAuthStore((s) => s.beginSession)
  const processed = useRef(false)
  const [authenticated, setAuthenticated] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    if (processed.current) return
    processed.current = true
    // 백엔드는 항상 URL 프래그먼트(#token=...)로 access token을 전달
    const params = new URLSearchParams(window.location.hash.slice(1))
    const token = params.get('token')
    // Remove credentials from the address bar/history before any follow-up request.
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)

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

    beginSession(token)
    setAuthenticated(true)
  }, [router, beginSession])

  if (authenticated) return <PostAuthNavigation />

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
