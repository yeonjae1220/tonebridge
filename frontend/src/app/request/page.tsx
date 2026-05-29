'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { useWaveSurfer } from '@/hooks/useWaveSurfer'
import { LanguagePicker } from '@/components/language-picker/LanguagePicker'
import { useI18n } from '@/i18n/I18nProvider'

const FEEDBACK_GOALS = [
  { key: 'goal.pronunciation', value: '발음' },
  { key: 'goal.grammar', value: '문법' },
  { key: 'goal.naturalness', value: '자연스러움' },
  { key: 'goal.intonation', value: '억양' },
  { key: 'goal.casual', value: '캐주얼' },
  { key: 'goal.business', value: '비즈니스' },
] as const

type Tab = 'TEXT' | 'AUDIO'

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function RecordedAudioPreview({
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

export default function RequestPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('TEXT')
  const [targetLanguage, setTargetLanguage] = useState('')
  const [targetVariant, setTargetVariant] = useState<string | null>(null)
  const [contentText, setContentText] = useState('')
  const [context, setContext] = useState('')
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [error, setError] = useState('')
  const [recordSheetOpen, setRecordSheetOpen] = useState(false)

  const recorder = useAudioRecorder()
  const { upload, uploading } = usePresignedUpload()

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const textMutation = useMutation({
    mutationFn: () =>
      api.post('/correction-requests', {
        targetLanguage,
        targetVariant: targetVariant ?? undefined,
        contentText,
        context,
        feedbackGoals: selectedGoals,
      }),
    onSuccess: () => router.push('/feed'),
    onError: (e: unknown) => setError((e as AxiosError<{ message: string }>).response?.data?.message ?? t('request.failed')),
  })

  const audioMutation = useMutation({
    mutationFn: async () => {
      const file = recorder.getFile(`audio_${Date.now()}.webm`)
      if (!file) throw new Error(t('request.noAudioFile'))
      const audioKey = await upload(file)
      return api.post('/correction-requests/audio', {
        targetLanguage,
        targetVariant: targetVariant ?? undefined,
        audioKey,
        context,
        feedbackGoals: selectedGoals,
      })
    },
    onSuccess: () => router.push('/feed'),
    onError: (e: unknown) => setError((e as AxiosError<{ message: string }>).response?.data?.message ?? t('request.failed')),
  })

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    )
  }

  const handleSubmit = () => {
    setError('')
    if (tab === 'TEXT') textMutation.mutate()
    else audioMutation.mutate()
  }

  const creditCost = tab === 'TEXT' ? 5 : 10
  const isPending = textMutation.isPending || audioMutation.isPending || uploading
  const canSubmit =
    !!targetLanguage &&
    (tab === 'TEXT' ? !!contentText.trim() : recorder.state === 'stopped') &&
    !isPending

  if (!accessToken) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('request.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('request.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('request.typeQuestion')}</p>
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
              {(['TEXT', 'AUDIO'] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => { setTab(kind); setError('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    tab === kind ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {kind === 'TEXT' ? t('common.text') : t('common.audio')}
                </button>
              ))}
            </div>
          </div>

          {tab === 'TEXT' ? (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-700">{t('request.contentLabel')}</span>
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder={t('request.contentPlaceholder')}
                rows={6}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">{t('request.recordingLabel')}</p>
              <div className="flex flex-col items-center gap-4">
                {recorder.state === 'idle' && (
                  <button
                    type="button"
                    onClick={() => setRecordSheetOpen(true)}
                    className="w-full py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold shadow-sm transition-colors"
                  >
                    {t('request.startRecording')}
                  </button>
                )}
                {recorder.state === 'recording' && (
                  <div className="w-full flex items-center justify-between rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                    <span className="text-sm text-red-600 font-mono">{formatDuration(recorder.duration)}</span>
                    <button onClick={recorder.stop} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium">
                      {t('request.stopRecording')}
                    </button>
                  </div>
                )}
                {recorder.state === 'stopped' && recorder.audioUrl && (
                  <RecordedAudioPreview
                    audioUrl={recorder.audioUrl}
                    onReset={() => {
                      recorder.reset()
                      setRecordSheetOpen(true)
                    }}
                  />
                )}
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">{t('request.language')}</label>
            <LanguagePicker
              value={targetLanguage}
              variant={targetVariant}
              onLanguageChange={(code) => {
                setTargetLanguage(code)
                setTargetVariant(null)
              }}
              onVariantChange={setTargetVariant}
            />
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-gray-700">{t('request.context')}</span>
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={tab === 'TEXT' ? t('request.contextTextPlaceholder') : t('request.contextAudioPlaceholder')}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('request.feedbackFocus')}</p>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_GOALS.map((goal) => (
                <button
                  key={goal.key}
                  onClick={() => toggleGoal(goal.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedGoals.includes(goal.value)
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {t(goal.key)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">{t('request.creditCost')}</span>
            <span className="text-lg font-bold text-blue-600">-{creditCost}</span>
          </div>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl bg-blue-500 text-white font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors"
          >
            {isPending ? t('request.submitting') : t('request.submit')}
          </button>
        </div>
      </div>
      {recordSheetOpen && (
        <RecorderSheet
          recorder={recorder}
          onClose={() => setRecordSheetOpen(false)}
        />
      )}
    </main>
  )
}

function RecorderSheet({
  recorder,
  onClose,
}: {
  recorder: ReturnType<typeof useAudioRecorder>
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center px-4 pb-4">
      <div className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-xl flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('request.recordingLabel')}</h2>
          {recorder.state !== 'recording' && (
            <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">×</button>
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
