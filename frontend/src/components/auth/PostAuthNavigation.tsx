'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { resolvePostAuthPath } from '@/lib/authNavigate'
import { useI18n } from '@/i18n/I18nProvider'
import { QueryError } from '@/components/ui/QueryError'

/** Authentication succeeded; retries here must only read the profile. */
export function PostAuthNavigation() {
  const router = useRouter()
  const { t } = useI18n()
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setFailed(false)
    void resolvePostAuthPath(controller.signal).then(path => {
      if (!controller.signal.aborted) router.replace(path)
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true)
    })
    return () => controller.abort()
  }, [attempt, router])
  return <main className="min-h-screen flex items-center justify-center p-4">
    {failed ? <QueryError onRetry={() => setAttempt(value => value + 1)} />
      : <p role="status" className="text-sm text-gray-500">{t('common.loading')}</p>}
  </main>
}
