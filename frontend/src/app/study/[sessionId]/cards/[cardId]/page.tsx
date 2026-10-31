'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { RecordingTimeoutError } from '@/lib/recordingRequest'
import { recordingDrafts } from '@/lib/recordingDrafts'
import { useAuthStore } from '@/stores/authStore'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useStudyRecordingSave } from '@/hooks/useStudyRecordingSave'
import { useRecordingNavigation } from '@/hooks/useRecordingNavigation'
import { RecordingSaveStatus } from '@/components/recorder/RecordingSaveStatus'
import { StudyAudioPlayer } from '@/components/audio/StudyAudioPlayer'
import { QueryError } from '@/components/ui/QueryError'
import { formatDate } from '@/lib/dateUtils'
import { localizedLabel } from '@/lib/localizedLabels'
import { useI18n } from '@/i18n/I18nProvider'
import { RecorderModal } from '@/components/recorder/RecorderModal'
import { PracticeHistory } from '@/components/study/PracticeHistory'
import type { LearnerAttempt, NativeAudioEntry, StudyCard } from '@/types'

function NativeAudioPlayer({ audio }: { audio: NativeAudioEntry }) {
  const { language, t } = useI18n()
  return <div className="rounded-xl border border-gray-100 p-3">
    <StudyAudioPlayer exampleId={audio.id} label={t('study.cardDetail.nativeAudios')} />
    <p className="mt-2 text-xs text-gray-500">{formatDate(audio.createdAt, language)}</p>
    {audio.note && <p className="mt-2 text-sm text-gray-600">{audio.note}</p>}
  </div>
}

export default function StudyCardDetailPage() {
  const router = useRouter()
  const { sessionId, cardId } = useParams<{ sessionId: string; cardId: string }>()
  const { accessToken } = useAuthStore()
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()
  const queryClient = useQueryClient()
  const { language, t } = useI18n()
  const attemptRecorder = useAudioRecorder(`practice:${cardId}`)
  const nativeRecorder = useAudioRecorder(`example:${cardId}`)
  const attemptSave = useStudyRecordingSave(cardId, 'practice')
  const nativeSave = useStudyRecordingSave(cardId, 'example')
  const navigate = useRecordingNavigation()
  const [noteDraft, setNoteDraft] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [nativeModalOpen, setNativeModalOpen] = useState(false)
  const [attemptModalOpen, setAttemptModalOpen] = useState(false)
  const [recordingPurpose, setRecordingPurpose] = useState<'practice' | 'example'>('practice')

  useEffect(() => {
    const generation = useAuthStore.getState().sessionGeneration
    setRecordingPurpose(recordingDrafts.get(`${generation}:example:${cardId}`)
      && !recordingDrafts.get(`${generation}:practice:${cardId}`) ? 'example' : 'practice')
  }, [cardId])

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: card, isLoading, isError: cardError, refetch: refetchCard, isFetching: cardFetching } = useQuery<StudyCard>({
    queryKey: ['cards', cardId],
    queryFn: () => api.get(`/cards/${cardId}`).then((r) => r.data),
    enabled: !!accessToken && !!cardId,
  })

  const { data: attempts = [], isLoading: attemptsLoading, isError: attemptsError, refetch: refetchAttempts } = useQuery<LearnerAttempt[]>({
    queryKey: ['cards', cardId, 'attempts'],
    queryFn: () => api.get(`/cards/${cardId}/attempts`).then((r) => r.data),
    // A feedback link may return to a card still inside the default cache freshness window.
    refetchOnMount: 'always',
    enabled: !!accessToken && !!cardId,
  })

  const { data: nativeAudios = [], isLoading: examplesLoading, isError: examplesError, refetch: refetchExamples } = useQuery<NativeAudioEntry[]>({
    queryKey: ['cards', cardId, 'native-audios'],
    queryFn: () => api.get(`/cards/${cardId}/native-audios`).then((r) => r.data),
    enabled: !!accessToken && !!cardId,
  })

  useEffect(() => {
    if (card) setNoteDraft(card.note ?? '')
  }, [card])

  const submitAttemptMutation = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      setActionError(''); setNotice('')
      if (!attemptRecorder.audioBlob) throw new Error('NO_AUDIO')
      return attemptSave.save(attemptRecorder.audioBlob)
    },
    onSuccess: () => {
      setNotice(t('common.saved'))
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'attempts'] })
      queryClient.invalidateQueries({ queryKey: ['practice-feedback'] })
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'cards'] })
      attemptRecorder.clearSaved(attemptRecorder.audioBlob)
    },
    onError: (error) => setActionError(t(error instanceof RecordingTimeoutError ? 'recording.timeout' : 'study.cardDetail.submitAttemptFailed')),
  })

  const submitNativeAudioMutation = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      setActionError(''); setNotice('')
      if (!nativeRecorder.audioBlob) throw new Error('NO_AUDIO')
      return nativeSave.save(nativeRecorder.audioBlob)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'native-audios'] })
      queryClient.invalidateQueries({ queryKey: ['cards', cardId] })
      nativeRecorder.clearSaved(nativeRecorder.audioBlob)
      setNotice(t('common.saved'))
    },
    onError: (error) => setActionError(t(error instanceof RecordingTimeoutError ? 'recording.timeout' : 'study.cardDetail.nativeAudioFailed')),
  })

  const updateNoteMutation = useMutation({
    mutationFn: () => {
      setActionError(''); setNotice('')
      return api.patch(`/cards/${cardId}/note`, { note: noteDraft.trim() || null })
    },
    onSuccess: () => { setNotice(t('common.saved')); queryClient.invalidateQueries({ queryKey: ['cards', cardId] }) },
    onError: () => setActionError(t('study.cardDetail.noteSaveFailed')),
  })

  const addAttemptNoteMutation = useMutation({
    mutationFn: (payload: { attemptId: string; correctionNote: string; score: number | null }) => {
      setActionError(''); setNotice('')
      return api.patch(`/attempts/${payload.attemptId}/correction`, {
        correctionNote: payload.correctionNote,
        score: payload.score,
      })
    },
    onSuccess: () => {
      setNotice(t('common.saved'))
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'attempts'] })
      queryClient.invalidateQueries({ queryKey: ['practice-feedback'] })
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'cards'] })
    },
    onError: () => {}, // The expanded editor displays its error and retains the draft.
  })

  if (!accessToken) return null

  const permissionReady = !!card && !currentUserLoading && !!currentUser
  const recordingBusy = nativeModalOpen || attemptModalOpen
    || nativeRecorder.starting || attemptRecorder.starting
    || nativeRecorder.state === 'recording' || attemptRecorder.state === 'recording'
    || nativeRecorder.state === 'processing' || attemptRecorder.state === 'processing'
    || submitAttemptMutation.isPending || submitNativeAudioMutation.isPending

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(() => router.push(`/study/${sessionId}`))} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">←</button>
          <h1 className="text-xl font-bold text-gray-900">{t('study.cardDetail.title')}</h1>
        </div>

        {cardError ? (
          <QueryError onRetry={() => void refetchCard()} retrying={cardFetching} />
        ) : isLoading || !card ? (
          <div className="h-40 rounded-2xl bg-gray-200 animate-pulse" />
        ) : (
          <>
            <section className="bg-surface rounded-2xl border border-gray-100 p-5">
              <p className="text-lg font-black text-gray-900">{card.phrase}</p>
              {card.context && <p className="mt-2 text-sm text-gray-500">{card.context}</p>}
              {card.explanation && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">{card.explanation}</p>}
              {card.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {card.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {localizedLabel(tag, t)}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-surface rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-900">{t('study.cardDetail.nativeAudios')}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {examplesError ? <QueryError onRetry={() => void refetchExamples()} /> : examplesLoading ? <p role="status">{t('common.loading')}</p> : nativeAudios.length === 0 ? (
                  <p className="text-sm text-gray-400">{t('study.cardDetail.noNativeAudios')}</p>
                ) : nativeAudios.map((audio) => (
                  <NativeAudioPlayer key={audio.id} audio={audio} />
                ))}
              </div>
            </section>

            {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
            {actionError && (
              <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {actionError}
              </div>
            )}

            {permissionReady && (
              <div className="flex gap-2" role="group" aria-label={t('study.cardDetail.recordingPurpose')}>
                {(['practice', 'example'] as const).map((purpose) => (
                  <button
                    key={purpose}
                    type="button"
                    aria-pressed={recordingPurpose === purpose}
                    disabled={recordingBusy}
                    onClick={() => setRecordingPurpose(purpose)}
                    className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-40 ${recordingPurpose === purpose ? 'bg-action-primary text-white' : 'bg-surface border border-gray-200 text-gray-700'}`}
                  >
                    {t(purpose === 'practice' ? 'study.cardDetail.practiceRecording' : 'study.cardDetail.nativeAudio')}
                  </button>
                ))}
              </div>
            )}
            {!permissionReady ? (
              <section className="h-32 rounded-2xl bg-gray-200 animate-pulse" />
            ) : recordingPurpose === 'example' ? (
              <section id="recording-panel" className="bg-surface rounded-2xl border border-gray-100 p-5">
                <h2 className="text-sm font-bold text-gray-900">{t('study.cardDetail.nativeAudio')}</h2>
                <p className="mt-1 text-xs text-gray-400">{t('study.cardDetail.nativeAudioHelp')}</p>
                <div className="mt-3 flex flex-col gap-3">
                  {nativeRecorder.state === 'idle' && (
                    <button
                      type="button"
                      onClick={() => setNativeModalOpen(true)}
                      disabled={recordingBusy}
                      className="w-full py-3 rounded-xl bg-action-record text-white text-sm font-semibold hover:bg-action-record-hover transition-colors disabled:opacity-40"
                    >
                      {t('study.cardDetail.startRecording')}
                    </button>
                  )}
                  {nativeRecorder.state === 'stopped' && (
                    <button
                      type="button"
                      onClick={() => setNativeModalOpen(true)}
                      disabled={recordingBusy}
                      className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {t('request.recordAgain')}
                    </button>
                  )}
                  {nativeRecorder.state === 'stopped' && nativeRecorder.audioUrl && (
                    <><p className="text-xs text-gray-500">{t('recording.draft')}</p><audio controls src={nativeRecorder.audioUrl} className="w-full h-9" /></>
                  )}
                  {nativeRecorder.state === 'stopped' && (
                    <button
                      onClick={() => submitNativeAudioMutation.mutate()}
                      disabled={submitNativeAudioMutation.isPending}
                      className="w-full rounded-xl bg-action-neutral py-2.5 text-sm font-semibold text-action-neutral-foreground disabled:opacity-40"
                    >
                      {submitNativeAudioMutation.isPending ? t('common.saving') : t('study.cardDetail.uploadNativeAudio')}
                    </button>
                  )}
                  <RecordingSaveStatus pending={submitNativeAudioMutation.isPending} stage={nativeSave.stage} />
                </div>
              </section>
            ) : (
              <section id="recording-panel" className="bg-surface rounded-2xl border border-gray-100 p-5">
                <h2 className="text-sm font-bold text-gray-900">{t('study.cardDetail.practiceRecording')}</h2>
                <p className="mt-1 text-xs text-gray-400">{t('study.cardDetail.practiceHelp')}</p>
                <div className="mt-3 flex flex-col gap-3">
                  {attemptRecorder.state === 'idle' && (
                    <button
                      type="button"
                      onClick={() => setAttemptModalOpen(true)}
                      disabled={recordingBusy}
                      className="w-full py-3 rounded-xl bg-action-record text-white text-sm font-semibold hover:bg-action-record-hover transition-colors disabled:opacity-40"
                    >
                      {t('study.cardDetail.startRecording')}
                    </button>
                  )}
                  {attemptRecorder.state === 'stopped' && (
                    <button
                      type="button"
                      onClick={() => setAttemptModalOpen(true)}
                      disabled={recordingBusy}
                      className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {t('request.recordAgain')}
                    </button>
                  )}
                  {attemptRecorder.state === 'stopped' && attemptRecorder.audioUrl && (
                    <><p className="text-xs text-gray-500">{t('recording.draft')}</p><audio controls src={attemptRecorder.audioUrl} className="w-full h-9" /></>
                  )}
                  {attemptRecorder.state === 'stopped' && (
                    <button
                      onClick={() => submitAttemptMutation.mutate()}
                      disabled={submitAttemptMutation.isPending}
                      className="w-full rounded-xl bg-action-neutral py-2.5 text-sm font-semibold text-action-neutral-foreground disabled:opacity-40"
                    >
                      {submitAttemptMutation.isPending ? t('common.saving') : t('study.cardDetail.submitAttempt')}
                    </button>
                  )}
                  <RecordingSaveStatus pending={submitAttemptMutation.isPending} stage={attemptSave.stage} />
                </div>
              </section>
            )}

            <PracticeHistory key={cardId} attempts={attempts} userId={currentUser?.id}
              loading={attemptsLoading} failed={attemptsError} onRetry={() => void refetchAttempts()}
              recordingBusy={recordingBusy} canEdit={permissionReady}
              onPractice={() => { setRecordingPurpose('practice'); setAttemptModalOpen(true) }}
              onSave={payload => addAttemptNoteMutation.mutateAsync(payload)} />
            <details id="card-note" className="bg-surface rounded-2xl border border-gray-100 p-5">
              <summary className="cursor-pointer text-sm font-bold text-gray-900">{t('study.cardDetail.cardNote')}</summary>
              <textarea
                aria-label={t('study.cardDetail.cardNote')}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={3}
                placeholder={t('study.cardDetail.cardNotePlaceholder')}
                className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none"
              />
              <button
                onClick={() => updateNoteMutation.mutate()}
                disabled={updateNoteMutation.isPending}
                className="mt-3 w-full rounded-xl bg-action-primary py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {updateNoteMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
            </details>

          </>
        )}
      </div>
      {nativeModalOpen && (
        <RecorderModal
          recorder={nativeRecorder}
          onClose={() => setNativeModalOpen(false)}
          title={t('study.cardDetail.nativeAudio')}
        />
      )}
      {attemptModalOpen && (
        <RecorderModal
          recorder={attemptRecorder}
          onClose={() => setAttemptModalOpen(false)}
          title={t('study.cardDetail.practiceRecording')}
        />
      )}
      {card && (
        <div className="px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-lg flex-wrap gap-3">
            <button
              type="button"
              onClick={() => { const note = document.getElementById('card-note') as HTMLDetailsElement | null; if (note) { note.open = true; note.scrollIntoView({ behavior: 'smooth', block: 'center' }); note.querySelector('textarea')?.focus() } }}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-700"
            >
              {t('study.cardDetail.cardNote')}
            </button>
            <button
              type="button"
              onClick={() => navigate(() => router.push('/request?destination=COMMUNITY&sourceCard=' + encodeURIComponent(cardId)))}
              className="flex-1 rounded-xl bg-action-neutral py-2.5 text-xs font-bold text-action-neutral-foreground"
            >
              {t('study.askCommunity')}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
