'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'
import LandingPage from '@/components/landing/LandingPage'

export default function HomePage() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const { data: user, isLoading } = useCurrentUser()

  // accessToken은 복원됐지만 유저 정보를 아직 fetch 중 — 랜딩 페이지 플래시 방지
  if (accessToken && isLoading) return null
  if (!user) return <LandingPage />

  return <RedirectToStudy />
}

function RedirectToStudy() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/study')
  }, [router])

  return null
}
