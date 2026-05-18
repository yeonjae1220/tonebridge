'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

function AuthCallbackInner() {
  const router = useRouter()
  const setAccessToken = useAuthStore((s) => s.setAccessToken)

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
    const raw = sessionStorage.getItem('auth_redirect') ?? '/onboarding'
    sessionStorage.removeItem('auth_redirect')
    router.replace(isSafeRedirect(raw) ? raw : '/onboarding')
  }, [router, setAccessToken])

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm animate-pulse">로그인 중...</p>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm animate-pulse">로그인 중...</p>
      </main>
    }>
      <AuthCallbackInner />
    </Suspense>
  )
}
