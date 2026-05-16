'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

function AuthCallbackInner() {
  const router = useRouter()
  const setTokens = useAuthStore((s) => s.setTokens)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1))
    const token = params.get('token')
    const refresh = params.get('refresh')

    if (!token || !refresh) {
      router.replace('/login?error=missing_tokens')
      return
    }

    // 최소한의 JWT 형식 검증 (3개의 .으로 구분된 세그먼트)
    const isJwt = (s: string) => /^[\w-]+\.[\w-]+\.[\w-]+$/.test(s)
    if (!isJwt(token) || !isJwt(refresh)) {
      router.replace('/login?error=invalid_token_format')
      return
    }

    setTokens(token, refresh)
    router.replace('/onboarding')
  }, [router, setTokens])

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
