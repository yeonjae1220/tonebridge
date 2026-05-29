'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { usePresignedUpload } from '@/hooks/usePresignedUpload'
import { useWaveSurfer } from '@/hooks/useWaveSurfer'
import { formatDate } from '@/lib/dateUtils'
import { localizedLabel } from '@/lib/localizedLabels'
import { useI18n } from '@/i18n/I18nProvider'
import { RecorderModal } from '@/components/recorder/RecorderModal'
import type { LearnerAttempt, NativeAudioEntry, StudyCard } from '@/types'

function NativeAudioPlayer({ audio }: { audio: NativeAudioEntry }) {
  const ref = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const { language, t } = useI18n()
  const ws = useWaveSurfer(ref, url)

  useEffect(() => {
    api
      .get<{ downloadUrl: string }>(`/native-audios/${audio.id}/download-url`)
      .then((r) => setUrl(r.data.downloadUrl))
      .catch(() => setUrl(null))
  }, [audio.id])

  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div ref={ref} className="min-h-[48px] bg-gray-50 rounded-lg overflow-hidden" />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={ws.togglePlay}
          disabled={!ws.ready}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-40"
        >
          {ws.playing ? t('common.pause') : t('common.play')}
        </button>
        <span className="text-xs text-gray-400">{formatDate(audio.createdAt, language)}</span>
      </div>
      {audio.note && <p className="mt-2 text-xs text-gray-500">{audio.note}</p>}
    </div>
  )
}

function AttemptNoteForm({
  attempt,
  disabled,
  onSubmit,
}: {
  attempt: LearnerAttempt
  disabled: boolean
  onSubmit: (payload: { attemptId: string; correctionNote: string; score: number | null }) => void
}) {
  const { t } = useI18n()
  const [note, setNote] = useState(attempt.correctionNote ?? '')
  const [score, setScore] = useState<number>(attempt.score ?? 3)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!note.trim()) return
    onSubmit({ attemptId: attempt.id, correctionNote: note.trim(), score })
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder={t('study.cardDetail.notePlaceholder')}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none"
      />
      <div className="flex gap-2">
        <select
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={disabled || !note.trim()}
          className="flex-1 rounded-xl bg-blue-500 text-white text-sm font-semibold disabled:opacity-40"
        >
          {t('common.save')}
        </button>
      </div>
    </form>
  )
}

export default function StudyCardDetailPage() {
  const router = useRouter()
  const { sessionId, cardId } = useParams<{ sessionId: string; cardId: string }>()
  const { accessToken } = useAuthStore()
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()
  const queryClient = useQueryClient()
  const { language, t } = useI18n()
  const attemptRecorder = useAudioRecorder()
  const nativeRecorder = useAudioRecorder()
  const { upload, uploading } = usePresignedUpload()
  const [noteDraft, setNoteDraft] = useState('')
  const [actionError, setActionError] = useState('')
  const [nativeModalOpen, setNativeModalOpen] = useState(false)
  const [attemptModalOpen, setAttemptModalOpen] = useState(false)

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  const { data: card, isLoading } = useQuery<StudyCard>({
    queryKey: ['cards', cardId],
    queryFn: () => api.get(`/cards/${cardId}`).then((r) => r.data),
    enabled: !!accessToken && !!cardId,
  })

  const { data: attempts = [] } = useQuery<LearnerAttempt[]>({
    queryKey: ['cards', cardId, 'attempts'],
    queryFn: () => api.get(`/cards/${cardId}/attempts`).then((r) => r.data),
    enabled: !!accessToken && !!cardId,
  })

  const { data: nativeAudios = [] } = useQuery<NativeAudioEntry[]>({
    queryKey: ['cards', cardId, 'native-audios'],
    queryFn: () => api.get(`/cards/${cardId}/native-audios`).then((r) => r.data),
    enabled: !!accessToken && !!cardId,
  })

  useEffect(() => {
    if (card) setNoteDraft(card.note ?? '')
  }, [card])

  const submitAttemptMutation = useMutation({
    mutationFn: async () => {
      setActionError('')
      const file = attemptRecorder.getFile(`attempt_${Date.now()}.webm`)
      if (!file) throw new Error('NO_AUDIO')
      const audioKey = await upload(file)
      return api.post(`/cards/${cardId}/attempts`, { audioKey })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'attempts'] })
      queryClient.invalidateQueries({ queryKey: ['sessions', sessionId, 'cards'] })
      attemptRecorder.reset()
    },
    onError: () => setActionError(t('study.cardDetail.submitAttemptFailed')),
  })

  const submitNativeAudioMutation = useMutation({
    mutationFn: async () => {
      setActionError('')
      const file = nativeRecorder.getFile(`native_${Date.now()}.webm`)
      if (!file) throw new Error('NO_AUDIO')
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
      return api.post(`/cards/${cardId}/native-audios`, { audioKey: data.audioKey })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'native-audios'] })
      queryClient.invalidateQueries({ queryKey: ['cards', cardId] })
      nativeRecorder.reset()
    },
    onError: () => setActionError(t('study.cardDetail.nativeAudioFailed')),
  })

  const updateNoteMutation = useMutation({
    mutationFn: () => {
      setActionError('')
      return api.patch(`/cards/${cardId}/note`, { note: noteDraft.trim() || null })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards', cardId] }),
    onError: () => setActionError(t('study.cardDetail.noteSaveFailed')),
  })

  const addAttemptNoteMutation = useMutation({
    mutationFn: (payload: { attemptId: string; correctionNote: string; score: number | null }) => {
      setActionError('')
      return api.patch(`/attempts/${payload.attemptId}/correction`, {
        correctionNote: payload.correctionNote,
        score: payload.score,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards', cardId, 'attempts'] }),
    onError: () => setActionError(t('study.cardDetail.feedbackSaveFailed')),
  })

  if (!accessToken) return null

  const canManageCard = !!card && currentUser?.id === card.createdByUserId
  const permissionReady = !!card && !currentUserLoading && !!currentUser

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/study/${sessionId}`)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">←</button>
          <h1 className="text-xl font-bold text-gray-900">{t('study.cardDetail.title')}</h1>
        </div>

        {isLoading || !card ? (
          <div className="h-40 rounded-2xl bg-gray-200 animate-pulse" />
        ) : (
          <>
            <section className="bg-white rounded-2xl border border-gray-100 p-5">
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

            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-900">{t('study.cardDetail.cardNote')}</h2>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={3}
                placeholder={t('study.cardDetail.cardNotePlaceholder')}
                className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none"
              />
              <button
                onClick={() => updateNoteMutation.mutate()}
                disabled={updateNoteMutation.isPending}
                className="mt-3 w-full rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {updateNoteMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
            </section>

            {actionError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {actionError}
              </div>
            )}

            {!permissionReady ? (
              <section className="h-32 rounded-2xl bg-gray-200 animate-pulse" />
            ) : canManageCard ? (
              <section className="bg-white rounded-2xl border border-gray-100 p-5">
                <h2 className="text-sm font-bold text-gray-900">{t('study.cardDetail.nativeAudio')}</h2>
                <p className="mt-1 text-xs text-gray-400">{t('study.cardDetail.nativeAudioHelp')}</p>
                <div className="mt-3 flex flex-col gap-3">
                  {nativeRecorder.state === 'idle' && (
                    <button
                      type="button"
                      onClick={() => setNativeModalOpen(true)}
                      disabled={submitNativeAudioMutation.isPending}
                      className="w-full py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-40"
                    >
                      {t('study.cardDetail.startRecording')}
                    </button>
                  )}
                  {nativeRecorder.state === 'stopped' && (
                    <button
                      type="button"
                      onClick={() => setNativeModalOpen(true)}
                      className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {t('request.recordAgain')}
                    </button>
                  )}
                  {nativeRecorder.state === 'stopped' && nativeRecorder.audioUrl && (
                    <audio controls src={nativeRecorder.audioUrl} className="w-full h-9" />
                  )}
                  {nativeRecorder.state === 'stopped' && (
                    <button
                      onClick={() => submitNativeAudioMutation.mutate()}
                      disabled={submitNativeAudioMutation.isPending}
                      className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {submitNativeAudioMutation.isPending ? t('common.saving') : t('study.cardDetail.uploadNativeAudio')}
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section className="bg-white rounded-2xl border border-gray-100 p-5">
                <h2 className="text-sm font-bold text-gray-900">{t('study.cardDetail.practiceRecording')}</h2>
                <p className="mt-1 text-xs text-gray-400">{t('study.cardDetail.practiceHelp')}</p>
                <div className="mt-3 flex flex-col gap-3">
                  {attemptRecorder.state === 'idle' && (
                    <button
                      type="button"
                      onClick={() => setAttemptModalOpen(true)}
                      disabled={submitAttemptMutation.isPending || uploading}
                      className="w-full py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-40"
                    >
                      {t('study.cardDetail.startRecording')}
                    </button>
                  )}
                  {attemptRecorder.state === 'stopped' && (
                    <button
                      type="button"
                      onClick={() => setAttemptModalOpen(true)}
                      className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {t('request.recordAgain')}
                    </button>
                  )}
                  {attemptRecorder.state === 'stopped' && attemptRecorder.audioUrl && (
                    <audio controls src={attemptRecorder.audioUrl} className="w-full h-9" />
                  )}
                  {attemptRecorder.state === 'stopped' && (
                    <button
                      onClick={() => submitAttemptMutation.mutate()}
                      disabled={submitAttemptMutation.isPending || uploading}
                      className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {submitAttemptMutation.isPending || uploading ? t('common.saving') : t('study.cardDetail.submitAttempt')}
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-900">{t('study.cardDetail.nativeAudios')}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {nativeAudios.length === 0 ? (
                  <p className="text-sm text-gray-400">{t('study.cardDetail.noNativeAudios')}</p>
                ) : nativeAudios.map((audio) => (
                  <NativeAudioPlayer key={audio.id} audio={audio} />
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-900">{t('study.cardDetail.attempts')}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {attempts.length === 0 ? (
                  <p className="text-sm text-gray-400">{t('study.cardDetail.noAttempts')}</p>
                ) : attempts.map((attempt) => (
                  <div key={attempt.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{formatDate(attempt.attemptedAt, language)}</span>
                      {attempt.score != null && <span className="text-sm font-bold text-blue-600">{attempt.score}/5</span>}
                    </div>
                    {attempt.correctionNote && <p className="mt-2 text-sm text-gray-700">{attempt.correctionNote}</p>}
                    {canManageCard && (
                      <AttemptNoteForm
                        attempt={attempt}
                        disabled={addAttemptNoteMutation.isPending}
                        onSubmit={(payload) => addAttemptNoteMutation.mutate(payload)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
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
    </main>
  )
}
