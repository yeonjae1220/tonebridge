'use client'

import { useRef } from 'react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useWaveSurfer } from '@/hooks/useWaveSurfer'
import { useI18n } from '@/i18n/I18nProvider'

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
          className="w-11 h-11 rounded-full bg-gray-900 text-white flex items-center justify-center disabled:opacity-40"
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
        className="mt-3 w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-white transition-colors"
      >
        {t('request.recordAgain')}
      </button>
    </div>
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 pb-[env(safe-area-inset-bottom)]"
      onClick={(e) => {
        if (e.target === e.currentTarget && recorder.state !== 'recording') onClose()
      }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{heading}</h2>
          {recorder.state !== 'recording' && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
              aria-label="닫기"
            >
              ✕
            </button>
          )}
        </div>

        {recorder.state === 'idle' && (
          <button
            type="button"
            onClick={recorder.start}
            className="mx-auto w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-200 hover:bg-red-600 transition-colors"
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
              className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-200 hover:bg-red-600 transition-colors"
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
              className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              {t('request.useRecording')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
