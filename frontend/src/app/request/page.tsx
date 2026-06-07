'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { LanguagePicker } from '@/components/language-picker/LanguagePicker'
import { RecorderModal, RecordedAudioPreview, formatDuration } from '@/components/recorder/RecorderModal'
import { useI18n } from '@/i18n/I18nProvider'
import type { Friend, StudyCard, StudySession } from '@/types'

const FEEDBACK_GOALS = [
  { key: 'goal.pronunciation', value: '발음' },
  { key: 'goal.grammar', value: '문법' },
  { key: 'goal.naturalness', value: '자연스러움' },
  { key: 'goal.intonation', value: '억양' },
  { key: 'goal.casual', value: '캐주얼' },
  { key: 'goal.business', value: '비즈니스' },
] as const

type RequestKind = 'TEXT' | 'AUDIO'
type Destination = 'PERSONAL' | 'FRIEND' | 'COMMUNITY'

export default function RequestPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<RequestKind>('TEXT')
  const [destination, setDestination] = useState<Destination>('PERSONAL')
  const [selectedFriendId, setSelectedFriendId] = useState('')
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

  const { data: sessions = [] } = useQuery<StudySession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions').then((r) => r.data),
    enabled: !!accessToken,
  })

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/friends').then((r) => r.data),
    enabled: !!accessToken,
  })

  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId)

  const submitMutation = useMutation({
    mutationFn: async () => {
      setError('')
      if (destination === 'COMMUNITY') {
        if (kind === 'TEXT') {
          return api.post('/correction-requests', {
            targetLanguage,
            targetVariant: targetVariant ?? undefined,
            contentText,
            context,
            feedbackGoals: selectedGoals,
          })
        }
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
      }

      const session = await ensureStudySession()
      const card = await createStudyCard(session.id)

      if (kind === 'AUDIO') {
        await attachNativeAudio(card.id)
      }

      return { data: { sessionId: session.id, cardId: card.id } }
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      if (destination === 'COMMUNITY') {
        router.push('/community')
        return
      }
      const data = response.data as { sessionId: string; cardId: string }
      router.push(`/study/${data.sessionId}/cards/${data.cardId}`)
    },
    onError: (e: unknown) => {
      setError((e as AxiosError<{ message: string }>).response?.data?.message ?? t('request.failed'))
    },
  })

  const ensureStudySession = async () => {
    if (destination === 'PERSONAL') {
      const existing = sessions.find((session) => session.status === 'ACTIVE' && session.memberIds.length === 1)
      if (existing) return existing
      const { data } = await api.post<StudySession>('/sessions', { title: t('study.personalDefault') })
      return data
    }

    if (!selectedFriendId) throw new Error('NO_FRIEND')
    const existing = sessions.find((session) =>
      session.status === 'ACTIVE' &&
      session.memberIds.length > 1 &&
      session.memberIds.includes(selectedFriendId),
    )
    if (existing) return existing
    const { data } = await api.post<StudySession>('/sessions', {
      friendId: selectedFriendId,
      title: selectedFriend ? `${selectedFriend.username} ${t('study.practiceDefault')}` : null,
    })
    return data
  }

  const createStudyCard = async (sessionId: string) => {
    const phrase = kind === 'TEXT'
      ? contentText.trim()
      : context.trim() || t('request.audioCardTitle')
    const { data } = await api.post<StudyCard>(`/sessions/${sessionId}/cards`, {
      phrase,
      context: context.trim() || null,
      tags: selectedGoals,
    })
    return data
  }

  const attachNativeAudio = async (cardId: string) => {
    const file = recorder.getFile(`study_audio_${Date.now()}.webm`)
    if (!file) throw new Error(t('request.noAudioFile'))
    const { data } = await api.post<{ uploadUrl: string; audioKey: string }>(
      `/cards/${cardId}/native-audios/upload-url`,
      { fileName: file.name },
    )
    const putRes = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    if (!putRes.ok) throw new Error(`File upload failed: ${putRes.status}`)
    await api.post(`/cards/${cardId}/native-audios`, { audioKey: data.audioKey })
  }

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    )
  }

  const creditCost = destination === 'COMMUNITY' ? (kind === 'TEXT' ? 5 : 10) : 0
  const isPending = submitMutation.isPending || uploading
  const hasContent = kind === 'TEXT' ? !!contentText.trim() : recorder.state === 'stopped'
  const canSubmit =
    hasContent &&
    (destination !== 'FRIEND' || !!selectedFriendId) &&
    (destination !== 'COMMUNITY' || !!targetLanguage) &&
    !isPending

  const stepReady = useMemo(() => {
    if (step === 0) return hasContent
    if (step === 1) return destination !== 'FRIEND' || !!selectedFriendId
    return canSubmit
  }, [canSubmit, destination, hasContent, selectedFriendId, step])

  if (!accessToken) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('request.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('request.subtitle')}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[t('request.stepContent'), t('request.stepDestination'), t('request.stepFeedback')].map((label, index) => (
            <div key={label} className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${
              step === index ? 'bg-blue-500 text-white' : 'bg-surface text-gray-400 border border-gray-100'
            }`}>
              {index + 1}. {label}
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-gray-100 bg-surface p-5">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-700">{t('request.typeQuestion')}</p>
                <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
                  {(['TEXT', 'AUDIO'] as const).map((nextKind) => (
                    <button
                      key={nextKind}
                      onClick={() => { setKind(nextKind); setError('') }}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                        kind === nextKind ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {nextKind === 'TEXT' ? t('common.text') : t('common.audio')}
                    </button>
                  ))}
                </div>
              </div>

              {kind === 'TEXT' ? (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-700">{t('request.contentLabel')}</span>
                  <textarea
                    value={contentText}
                    onChange={(e) => setContentText(e.target.value)}
                    placeholder={t('request.contentPlaceholder')}
                    rows={7}
                    className="w-full resize-none rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </label>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-gray-700">{t('request.recordingLabel')}</p>
                  {recorder.state === 'idle' && (
                    <button
                      type="button"
                      onClick={() => setRecordSheetOpen(true)}
                      className="w-full rounded-xl bg-red-500 py-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600"
                    >
                      {t('request.startRecording')}
                    </button>
                  )}
                  {recorder.state === 'recording' && (
                    <div className="flex w-full items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-red-600">{formatDuration(recorder.duration)}</span>
                      <button onClick={recorder.stop} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">
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
              )}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3">
              {([
                ['PERSONAL', t('request.destinationPersonal'), t('request.destinationPersonalSub')],
                ['FRIEND', t('request.destinationFriend'), t('request.destinationFriendSub')],
                ['COMMUNITY', t('request.destinationCommunity'), t('request.destinationCommunitySub')],
              ] as const).map(([value, label, subtitle]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDestination(value)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    destination === value ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-surface hover:border-blue-200'
                  }`}
                >
                  <span className="text-sm font-black text-gray-900">{label}</span>
                  <span className="mt-1 block text-xs text-gray-500">{subtitle}</span>
                </button>
              ))}

              {destination === 'FRIEND' && (
                <label className="mt-2 flex flex-col gap-2">
                  <span className="text-sm font-semibold text-gray-700">{t('study.friendRequired')}</span>
                  <select
                    value={selectedFriendId}
                    onChange={(e) => setSelectedFriendId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-surface px-3 py-2.5 text-sm"
                  >
                    <option value="">{t('study.selectFriend')}</option>
                    {friends.map((friend) => (
                      <option key={friend.id} value={friend.id}>{friend.username}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              {destination === 'COMMUNITY' && (
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
              )}

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-700">{t('request.context')}</span>
                <input
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder={kind === 'TEXT' ? t('request.contextTextPlaceholder') : t('request.contextAudioPlaceholder')}
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </label>

              <div>
                <p className="mb-3 text-sm font-semibold text-gray-700">{t('request.feedbackFocus')}</p>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_GOALS.map((goal) => (
                    <button
                      key={goal.key}
                      type="button"
                      onClick={() => toggleGoal(goal.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        selectedGoals.includes(goal.value)
                          ? 'border-blue-300 bg-blue-100 text-blue-700'
                          : 'border-gray-200 bg-surface text-gray-500 hover:border-blue-300'
                      }`}
                    >
                      {t(goal.key)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-600">{t('request.creditCost')}</span>
                <span className="text-lg font-bold text-blue-600">{creditCost === 0 ? '0' : `-${creditCost}`}</span>
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}

          <div className="mt-5 flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((prev) => prev - 1)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => prev + 1)}
                disabled={!stepReady}
                className="flex-1 rounded-xl bg-blue-500 py-3 font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-40"
              >
                {t('common.next')}
              </button>
            ) : (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit}
                className="flex-1 rounded-xl bg-blue-500 py-3 font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-40"
              >
                {isPending ? t('request.submitting') : t('request.submit')}
              </button>
            )}
          </div>
        </section>
      </div>
      {recordSheetOpen && (
        <RecorderModal
          recorder={recorder}
          onClose={() => setRecordSheetOpen(false)}
        />
      )}
    </main>
  )
}
