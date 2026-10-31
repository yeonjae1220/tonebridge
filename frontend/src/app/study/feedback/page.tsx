'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PracticeFeedback } from '@/components/study/PracticeFeedback'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'

export default function FeedbackPage() {
  const { accessToken } = useAuthStore()
  const { t } = useI18n()
  const router = useRouter()
  useEffect(() => { if (!accessToken) router.replace('/login') }, [accessToken, router])
  if (!accessToken) return null
  return <main className="min-h-screen bg-gray-50 pb-28">
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link href="/study" className="mb-4 inline-flex min-h-11 items-center text-sm text-blue-600">← {t('nav.study')}</Link>
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t('feedback.title')}</h1>
      <PracticeFeedback />
    </div>
  </main>
}
