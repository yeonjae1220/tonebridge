'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { QueryError } from '@/components/ui/QueryError'

/** Resolve record IDs through the authenticated membership check, never a public bucket URL. */
export function StudyAudioPlayer({ attemptId, exampleId, label }: {
  attemptId?: string
  exampleId?: string
  label: string
}) {
  const generation = useAuthStore((state) => state.sessionGeneration)
  const { t } = useI18n()
  const [mediaFailed, setMediaFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const query = useQuery({
    queryKey: ['study-audio', generation, exampleId ? 'example' : 'attempt', exampleId ?? attemptId, retry],
    queryFn: () => (exampleId
      ? api.get<{ downloadUrl: string }>(`/native-audios/${exampleId}/download-url`)
      : api.get<{ downloadUrl: string }>(`/attempts/${attemptId}/download-url`)
    ).then((response) => response.data.downloadUrl),
    enabled: !!(exampleId || attemptId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  if (!attemptId && !exampleId) return <p className="text-sm text-gray-500">{t('study.audioUnavailable')}</p>
  if (query.isError || mediaFailed) return <QueryError onRetry={() => { setMediaFailed(false); setRetry((value) => value + 1) }} />
  if (!query.data) return <p role="status" className="text-sm text-gray-500">{t('common.loading')}</p>
  return <audio key={`${generation}:${retry}:${query.data}`} controls preload="metadata" aria-label={label}
    src={query.data} onError={() => setMediaFailed(true)} className="h-11 w-full" />
}
