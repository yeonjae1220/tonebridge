'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { QueryError } from '@/components/ui/QueryError'
import { decodedDuration } from '@/lib/audioDuration'
import { formatDuration } from '@/components/recorder/RecorderModal'

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
  const [duration, setDuration] = useState<number | null>(null)
  const [needsDuration, setNeedsDuration] = useState(false)
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
  useEffect(() => { setDuration(null); setNeedsDuration(false) }, [query.data])
  useEffect(() => {
    if (!needsDuration || !query.data) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    // Older MediaRecorder WebM files lack duration metadata. Derive their display
    // length without seeking the user's player or changing playback position.
    void fetch(query.data, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Audio unavailable')
      const seconds = await decodedDuration(await response.blob())
      if (!controller.signal.aborted) setDuration(seconds)
    }).catch(() => { /* Playback remains usable even if duration decoding is unsupported. */ })
      .finally(() => clearTimeout(timer))
    return () => { controller.abort(); clearTimeout(timer) }
  }, [needsDuration, query.data])
  if (!attemptId && !exampleId) return <p className="text-sm text-gray-500">{t('study.audioUnavailable')}</p>
  if (query.isError || mediaFailed) return <QueryError onRetry={() => { setMediaFailed(false); setRetry((value) => value + 1) }} />
  if (!query.data) return <p role="status" className="text-sm text-gray-500">{t('common.loading')}</p>
  return <>
    <audio key={`${generation}:${retry}:${query.data}`} controls preload="metadata" aria-label={label}
      onLoadedMetadata={(event) => {
        const value = event.currentTarget.duration
        if (Number.isFinite(value) && value > 0) setDuration(value)
        else setNeedsDuration(true)
      }}
      src={query.data} onError={() => setMediaFailed(true)} className="h-11 w-full" />
    {/* Match native media controls and the recorder preview: display completed seconds. */}
    {duration !== null && <p className="mt-1 text-xs text-gray-500">{t('recording.total')} {formatDuration(Math.floor(duration))}</p>}
  </>
}
