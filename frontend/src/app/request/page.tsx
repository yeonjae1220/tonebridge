'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { captureAccountGuard, uploadRecording } from '@/lib/validationDiagnostics'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { isAxiosError } from 'axios'
import { clearComposition, createComposition, loadComposition, markCompositionUploaded, PendingCompositionError, type CompositionDraft } from '@/lib/compositionDraft'
import { LanguagePicker } from '@/components/language-picker/LanguagePicker'
import { RecorderModal, RecordedAudioPreview, formatDuration } from '@/components/recorder/RecorderModal'
import { useI18n } from '@/i18n/I18nProvider'
import type { Friend, StudyCard } from '@/types'
import { QueryError } from '@/components/ui/QueryError'
import { getApiErrorMessage } from '@/lib/apiError'
import { useRecordingNavigation } from '@/hooks/useRecordingNavigation'
import { recordingRequest, RecordingTimeoutError } from '@/lib/recordingRequest'
import { RecordingDraftNotice } from '@/components/recorder/RecordingDraftNotice'

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
type SubmitPayload = { sessionGeneration: number; draft: CompositionDraft; audioFile?: File; audioBlob: Blob | null; edit?: boolean }
function belongsToCurrentAccount(payload: SubmitPayload) {
  const current = useAuthStore.getState()
  return !!current.accessToken && current.sessionGeneration === payload.sessionGeneration
}

type SubmitResult =
  | { type: 'community'; requestId: string }
  | { type: 'edit' }
  | { type: 'unavailable' }
  | { type: 'study'; sessionId: string; cardId: string }

export default function RequestPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken } = useAuthStore()
  const { data: currentUser } = useCurrentUser()
  const [pending, setPending] = useState<CompositionDraft | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [stage, setStage] = useState<'checking' | 'uploading' | 'saving'>('checking')
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
  const [sourceCardId, setSourceCardId] = useState<string | null>(null)
  const appliedSource = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const intent = params.get('destination')
    setSourceCardId(params.get('sourceCard'))
    if (params.get('kind') === 'AUDIO') { setKind('AUDIO'); setRecordSheetOpen(true) }
    if (intent === 'COMMUNITY' || intent === 'FRIEND' || intent === 'PERSONAL') setDestination(intent)
  }, [])

  const source = useQuery<StudyCard>({
    queryKey: ['cards', sourceCardId],
    queryFn: () => api.get(`/cards/${encodeURIComponent(sourceCardId!)}`).then((response) => response.data),
    enabled: !!accessToken && !!sourceCardId,
  })
  useEffect(() => {
    if (pending || !source.data || appliedSource.current === source.data.id) return
    appliedSource.current = source.data.id
    setContentText(source.data.phrase)
    setContext(source.data.context ?? '')
  }, [source.data, pending])

  const recorder = useAudioRecorder('compose')
  useEffect(() => {
    if (recorder.audioBlob && !pending && !contentText) setKind('AUDIO')
  }, [recorder.audioBlob, pending, contentText])
  const navigate = useRecordingNavigation()
  useEffect(() => {
    if (!currentUser) return
    try {
      const draft = loadComposition(currentUser.id)
      setPending(draft)
      if (draft) {
        setKind(draft.input.kind); setDestination(draft.input.destination)
        setSelectedFriendId(draft.input.friendId ?? ''); setTargetLanguage(draft.input.targetLanguage)
        setTargetVariant(draft.input.targetVariant); setContentText(draft.input.contentText)
        setContext(draft.input.context); setSelectedGoals(draft.input.goals)
        setStep(2); setRecordSheetOpen(false)
      }
      setDraftReady(true)
    } catch { setError(t('compose.storageError')) }
  }, [currentUser, t])

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/friends').then((r) => r.data),
    enabled: !!accessToken,
  })

  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId)

  const submitMutation = useMutation<SubmitResult, unknown, SubmitPayload>({
    mutationFn: async (payload) => {
      const requireSameAccount = captureAccountGuard()
      if (!belongsToCurrentAccount(payload)) throw new Error('Account changed')
      requireSameAccount()
      setError('')
      const { draft } = payload
      const path = `/compositions/${draft.operation}`
      setStage('checking')
      if (payload.edit) {
        const { data, status } = await recordingRequest((signal) => api.post<SubmitResult>(`${path}/cancel`, {}, { signal }))
        requireSameAccount()
        return status === 204 ? { type: 'edit' } : data
      }
      try {
        const { data } = await recordingRequest((signal) => api.get<SubmitResult>(path, { signal }))
        requireSameAccount()
        return data
      } catch (error) {
        requireSameAccount()
        if (!isAxiosError(error) || error.response?.status !== 404) throw error
      }
      if (draft.input.kind === 'AUDIO' && !draft.uploaded) {
        if (!payload.audioFile) throw new Error(t('request.noAudioFile'))
        const file = payload.audioFile
        setStage('uploading')
        const { data } = await recordingRequest((signal) => api.post<{ uploadUrl: string }>(
          `${path}/upload-url`, { contentType: file.type }, { signal },
        ))
        requireSameAccount()
        await uploadRecording(data.uploadUrl, file)
        requireSameAccount()
        markCompositionUploaded(draft)
        setPending({ ...draft, uploaded: true })
      }
      setStage('saving')
      const { data } = await recordingRequest((signal) => api.post<SubmitResult>(path, draft.input, { signal }))
      requireSameAccount()
      return data
    },
    onSuccess: (result, payload) => {
      if (!belongsToCurrentAccount(payload)) return
      clearComposition(payload.draft)
      setPending(null)
      if (result.type === 'edit' || result.type === 'unavailable') {
        if (result.type === 'unavailable') setError(t('compose.unavailable'))
        setStep(0); return
      }
      if (payload.draft.input.kind === 'AUDIO') recorder.clearSaved(payload.audioBlob)
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      if (result.type === 'community') {
        router.push('/community')
        return
      }
      queryClient.invalidateQueries({ queryKey: ['cards', result.sessionId] })
      router.push(`/study/${result.sessionId}/cards/${result.cardId}`)
    },
    onError: (e: unknown, payload) => {
      if (!belongsToCurrentAccount(payload)) return
      setError(e instanceof RecordingTimeoutError ? t('recording.timeout') : getApiErrorMessage(e, t('request.failed')))
    },
  })

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    )
  }

  const handleSubmit = async (edit = false) => {
    if (!currentUser || submitMutation.isPending) return
    const generation = useAuthStore.getState().sessionGeneration
    const requireSameAccount = captureAccountGuard()
    try {
      const draft = pending ?? await createComposition(currentUser.id, {
        kind, destination, friendId: destination === 'FRIEND' ? selectedFriendId : null,
        title: destination === 'PERSONAL' ? t('study.personalDefault') : `${selectedFriend?.username ?? ''} ${t('study.practiceDefault')}`,
        contentText, context, audioTitle: t('request.audioCardTitle'), targetLanguage, targetVariant, goals: [...selectedGoals],
      })
      requireSameAccount()
      setPending(draft)
      submitMutation.mutate({
        sessionGeneration: generation, draft, edit,
        audioFile: recorder.getFile('composition.webm') ?? undefined, audioBlob: recorder.audioBlob,
      })
    } catch (error) {
      if (generation === useAuthStore.getState().sessionGeneration)
        setError(t(error instanceof PendingCompositionError ? 'compose.otherPending' : 'compose.storageError'))
    }
  }

  const isPending = submitMutation.isPending
  const locked = isPending || !!pending
  const hasContent = kind === 'TEXT' ? !!contentText.trim() : recorder.state === 'stopped'
  const canSubmit = draftReady && !isPending && (!!pending || (
    hasContent &&
    (destination !== 'FRIEND' || !!selectedFriendId) &&
    (destination !== 'COMMUNITY' || !!targetLanguage) &&
    (!sourceCardId || (source.isSuccess && !source.isError))))
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
          <button type="button" onClick={() => navigate(() => router.back())} className="mb-3 min-h-11 text-sm font-semibold text-blue-600">← {t('common.back')}</button>
          <h1 className="text-2xl font-bold text-gray-900">{t('request.composeTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('request.composeHelp')}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[t('request.stepContent'), t('request.stepDestination'), t('request.stepFeedback')].map((label, index) => (
            <div key={label} className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${
              step === index ? 'bg-action-primary text-white' : 'bg-surface text-gray-400 border border-gray-100'
            }`}>
              {index + 1}. {label}
            </div>
          ))}
        </div>

        {sourceCardId && <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-800">{t('request.sourceNotice')}</p>}
        {!pending && sourceCardId && source.isError ? <QueryError onRetry={() => void source.refetch()} /> : !pending && sourceCardId && source.isLoading ? <p role="status">{t('common.loading')}</p> : <section className="rounded-2xl border border-gray-100 bg-surface p-5"><fieldset disabled={locked} className="min-w-0">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-700">{t('request.typeQuestion')}</p>
                <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
                  {(['TEXT', 'AUDIO'] as const).map((nextKind) => (
                    <button
                      key={nextKind}
                    onClick={() => { setKind(nextKind); setError('') }}
                    disabled={locked}
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
                    maxLength={destination === 'COMMUNITY' ? 10000 : 500}
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
                  <RecordingDraftNotice recorder={recorder} />
                  {recorder.state === 'idle' && (
                    <button
                      type="button"
                      onClick={() => setRecordSheetOpen(true)}
                      disabled={locked}
                      className="w-full rounded-xl bg-action-record py-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-action-record-hover"
                    >
                      {t('request.startRecording')}
                    </button>
                  )}
                  {recorder.state === 'recording' && (
                    <div className="flex w-full items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-red-600">{formatDuration(recorder.duration)}</span>
                      <button type="button" onClick={recorder.stop} className="rounded-lg bg-action-neutral px-4 py-2 text-sm font-medium text-action-neutral-foreground">
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
                  disabled={locked}
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
                    disabled={locked}
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
                  maxLength={kind === 'AUDIO' && destination !== 'COMMUNITY' ? 500 : 10000}
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
                      disabled={locked}
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

            </div>
          )}

          </fieldset>
          {pending && <div role="status" className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p>{isPending ? t(stage === 'uploading' ? 'recording.uploading' : stage === 'saving' ? 'compose.saving' : 'compose.checking') : t('compose.pending')}</p>
            {!isPending && <button type="button" onClick={() => handleSubmit(true)} className="mt-2 min-h-11 font-semibold underline">{t('compose.edit')}</button>}
          </div>}
          {step === 2 && <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">{t(destination === 'COMMUNITY' ? 'request.destinationCommunitySub' : destination === 'FRIEND' ? 'request.destinationFriendSub' : 'request.destinationPersonalSub')}</p>}
          {error && <p role="alert" className="mt-4 text-sm font-medium text-red-500">{error}</p>}

          <div className="mt-5 flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((prev) => prev - 1)}
                disabled={locked}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => prev + 1)}
                disabled={!stepReady || isPending}
                className="flex-1 rounded-xl bg-action-primary py-3 font-semibold text-white transition-colors hover:bg-action-primary-hover disabled:opacity-40"
              >
                {t('common.next')}
              </button>
            ) : (
              <button
                onClick={() => handleSubmit()}
                disabled={!canSubmit}
                className="flex-1 rounded-xl bg-action-primary py-3 font-semibold text-white transition-colors hover:bg-action-primary-hover disabled:opacity-40"
              >
                {isPending ? t('request.submitting') : pending ? t('compose.resume') : t(destination === 'COMMUNITY' ? 'request.submit' : destination === 'FRIEND' ? 'request.destinationFriend' : 'common.save')}
              </button>
            )}
          </div>
        </section>}
      </div>
      {recordSheetOpen && !pending && (
        <RecorderModal
          recorder={recorder}
          onClose={() => setRecordSheetOpen(false)}
        />
      )}
    </main>
  )
}
