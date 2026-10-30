'use client'

import { useRef } from 'react'
import { useAudioRecorder, type RecorderError } from '@/hooks/useAudioRecorder'
import { useWaveSurfer } from '@/hooks/useWaveSurfer'
import { useI18n } from '@/i18n/I18nProvider'
import { Dialog } from '@/components/ui/Dialog'

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function RecordedAudioPreview({
  audioUrl,
  onReset,
}: {
  audioUrl: string
  onReset: () => void
}) {
  const waveformRef = useRef<HTMLDivElement | null>(null)
  const { playing, currentTime, duration, ready, togglePlay } = useWaveSurfer(waveformRef, audioUrl)
  const { t } = useI18n()

  return (
    <div className="w-full rounded-2xl bg-gray-50 border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!ready}
          className="w-11 h-11 rounded-full bg-action-neutral text-action-neutral-foreground flex items-center justify-center disabled:opacity-40"
          aria-label={playing ? t('common.stop') : t('common.play')}
        >
          {playing ? 'Ⅱ' : '▶'}
        </button>
        <div className="flex-1 min-w-0">
          <div ref={waveformRef} className="w-full cursor-pointer" />
          <div className="mt-1 flex justify-between text-[11px] text-gray-400 font-mono">
            <span>{formatDuration(Math.floor(currentTime))}</span>
            <span>{formatDuration(Math.floor(duration))}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="mt-3 w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-surface transition-colors"
      >
        {t('request.recordAgain')}
      </button>
    </div>
  )
}

const RECORDER_ERROR_KEYS = {
  permissionDenied: 'recorder.error.permissionDenied',
  blocked: 'recorder.error.blocked',
  noDevice: 'recorder.error.noDevice',
  busy: 'recorder.error.busy',
  unsupported: 'recorder.error.unsupported',
  unknown: 'recorder.error.unknown',
} as const satisfies Record<RecorderError, string>

export function RecorderErrorMessage({ error }: { error: RecorderError | null }) {
  const { t } = useI18n()
  if (!error) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
      {t(RECORDER_ERROR_KEYS[error])}
    </p>
  )
}

interface RecorderModalProps {
  recorder: ReturnType<typeof useAudioRecorder>
  onClose: () => void
  title?: string
}

export function RecorderModal({ recorder, onClose, title }: RecorderModalProps) {
  const { t } = useI18n()
  const heading = title ?? t('request.recordingLabel')
  const close = () => {
    if (recorder.starting) recorder.reset()
    onClose()
  }

  return (
    <Dialog title={heading} onClose={close} busy={recorder.state === 'recording'}>
      <div className="flex flex-col gap-5">
        <RecorderErrorMessage error={recorder.error} />

        {recorder.state === 'idle' && (
          <button
            type="button"
            onClick={() => void recorder.start()}
            disabled={recorder.starting}
            className="mx-auto w-20 h-20 rounded-full bg-action-record text-white flex items-center justify-center shadow-lg shadow-red-200 hover:bg-action-record-hover transition-colors"
            aria-label={t('request.startRecording')}
          >
            <span className="text-3xl">●</span>
          </button>
        )}

        {recorder.state === 'recording' && (
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={recorder.stop}
              className="w-20 h-20 rounded-full bg-action-record text-white flex items-center justify-center shadow-lg shadow-red-200 hover:bg-action-record-hover transition-colors"
              aria-label={t('request.stopRecording')}
            >
              <span className="w-7 h-7 rounded-sm bg-white" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono text-red-600">{formatDuration(recorder.duration)}</span>
            </div>
          </div>
        )}

        {recorder.state === 'stopped' && recorder.audioUrl && (
          <>
            <RecordedAudioPreview audioUrl={recorder.audioUrl} onReset={recorder.reset} />
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-action-primary text-white text-sm font-semibold hover:bg-action-primary-hover transition-colors"
            >
              {t('request.useRecording')}
            </button>
          </>
        )}
      </div>
    </Dialog>
  )
}
