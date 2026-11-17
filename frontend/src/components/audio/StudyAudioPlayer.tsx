'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { withRequestDeadline } from '@/lib/requestDeadline'
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
  const query = useQuery({
    queryKey: ['study-audio', generation, exampleId ? 'example' : 'attempt', exampleId ?? attemptId, retry],
    queryFn: ({ signal }) => withRequestDeadline(requestSignal => (exampleId
      ? api.get<{ downloadUrl: string }>(`/native-audios/${exampleId}/download-url`, { signal: requestSignal })
      : api.get<{ downloadUrl: string }>(`/attempts/${attemptId}/download-url`, { signal: requestSignal })
    ).then((response) => response.data.downloadUrl), 15_000, signal),
    enabled: !!(exampleId || attemptId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    // A new signed URL replaces the media element and resets its playback position.
    // Re-authorize on mount or explicit recovery, not on background focus/reconnect.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  if (!attemptId && !exampleId) return <p className="text-sm text-gray-500">{t('study.audioUnavailable')}</p>
  if (query.isError || mediaFailed) return <QueryError onRetry={() => { setMediaFailed(false); setRetry((value) => value + 1) }} />
  if (!query.data) return <p role="status" className="text-sm text-gray-500">{t('common.loading')}</p>
  return <StudyAudioMedia key={`${generation}:${retry}:${query.data}`} url={query.data} label={label} onFailure={setMediaFailed} />
}

/** Each source owns its load deadline and media element, including cleanup on retry. */
function StudyAudioMedia({ url, label, onFailure }: { url: string; label: string; onFailure: (failed: boolean) => void }) {
  const { t } = useI18n()
  const audioRef = useRef<HTMLAudioElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [duration, setDuration] = useState<number | null>(null)
  const [needsDuration, setNeedsDuration] = useState(false)
  const clearWait = useCallback(() => { clearTimeout(timerRef.current); timerRef.current = undefined }, [])
  const waitForMedia = useCallback(() => {
    clearWait()
    timerRef.current = setTimeout(() => onFailure(true), 30_000)
  }, [clearWait, onFailure])
  useEffect(() => {
    const audio = audioRef.current
    // Metadata may arrive before passive effects; do not time out a ready player.
    if (audio && !audio.getAttribute('src')) audio.src = url
    if (audio?.readyState === 0) waitForMedia()
    return () => {
      clearWait()
      // Removing a player alone does not reliably abort its pending media request.
      audio?.pause()
      audio?.removeAttribute('src')
      audio?.load()
    }
  }, [clearWait, waitForMedia, url])
  useEffect(() => {
    if (!needsDuration || !url) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    // Older MediaRecorder WebM files lack duration metadata. Derive their display
    // length without seeking the user's player or changing playback position.
    void fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('Audio unavailable')
      const seconds = await decodedDuration(await response.blob())
      if (!controller.signal.aborted) setDuration(seconds)
    }).catch(() => { /* Playback remains usable even if duration decoding is unsupported. */ })
      .finally(() => clearTimeout(timer))
    return () => { controller.abort(); clearTimeout(timer) }
  }, [needsDuration, url])
  return <>
    <audio ref={audioRef} controls preload="metadata" aria-label={label}
      onLoadedMetadata={(event) => {
        clearWait()
        const value = event.currentTarget.duration
        if (Number.isFinite(value) && value > 0) setDuration(value)
        else setNeedsDuration(true)
      }}
      onWaiting={waitForMedia} onCanPlay={clearWait} onPlaying={clearWait} onPause={clearWait}
      src={url} onError={() => onFailure(true)} className="h-11 w-full" />
    {/* Match native media controls and the recorder preview: display completed seconds. */}
    {duration !== null && <p className="mt-1 text-xs text-gray-500">{t('recording.total')} {formatDuration(Math.floor(duration))}</p>}
  </>
}
