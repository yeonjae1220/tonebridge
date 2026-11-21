'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { LearnerAttempt } from '@/types'
import { useI18n } from '@/i18n/I18nProvider'
import { formatDate } from '@/lib/dateUtils'
import { QueryError } from '@/components/ui/QueryError'
import { StudyAudioPlayer } from '@/components/audio/StudyAudioPlayer'
import { WriteOutcomeUnknownError } from '@/lib/writeDeadline'
import { StudyScore } from './StudyScore'
import { FeedbackSoundPicker, FeedbackSoundTargets } from './FeedbackSounds'

type FeedbackPayload = { attemptId: string; correctionNote: string; score: number | null; soundGuideIds: string[] }

type FeedbackDraft = {
  open: boolean; note: string; score: number | null; soundGuideIds: string[]; pending: boolean; error: string | null
}
const initialFeedbackDraft = (attempt: LearnerAttempt): FeedbackDraft => ({
  open: false, note: attempt.correctionNote ?? '', score: attempt.score ?? null,
  soundGuideIds: (attempt.soundTargets ?? []).map(target => target.guideId), pending: false, error: null,
})

function FeedbackEditor({ attempt, onSave, onRetry, draft, update, preferredLanguages }: {
  onRetry: () => void; preferredLanguages: readonly string[]; attempt: LearnerAttempt; onSave: (payload: FeedbackPayload) => Promise<unknown>
  draft: FeedbackDraft; update: (patch: Partial<FeedbackDraft>) => void
}) {
  const { t } = useI18n()
  const { open, note, score, soundGuideIds, pending, error } = draft
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!note.trim() || pending) return
    update({ pending: true, error: null })
    try {
      await onSave({ attemptId: attempt.id, correctionNote: note.trim(), score, soundGuideIds })
      update({ open: false })
    } catch (error) {
      update({ error: t(error instanceof WriteOutcomeUnknownError ? 'common.saveUncertain' : 'study.cardDetail.feedbackSaveFailed') })
    } finally { update({ pending: false }) }
  }
  return <div className="mt-3">
    {!open ? <button type="button" className="min-h-11 text-sm font-semibold text-blue-600"
      onClick={() => update({ ...initialFeedbackDraft(attempt), open: true })}>
      {t(attempt.correctionNote ? 'history.edit' : 'history.write')}
    </button> : <form onSubmit={save} className="space-y-3">
      <textarea aria-label={t('study.cardDetail.notePlaceholder')} placeholder={t('study.cardDetail.notePlaceholder')} value={note}
        onChange={event => update({ note: event.target.value })} rows={3} disabled={pending}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
      <FeedbackSoundPicker selected={soundGuideIds} onChange={ids => update({ soundGuideIds: ids })}
        preferredLanguages={preferredLanguages} disabled={pending} />
      <div className="flex flex-wrap gap-2">
        <select aria-label={t('study.cardDetail.scoreLabel')} value={score ?? ''} disabled={pending}
          onChange={event => update({ score: event.target.value === '' ? null : Number(event.target.value) })}
          className="min-h-11 rounded-xl border border-gray-200 bg-surface px-3 text-sm">
          <option value="">{t('study.cardDetail.noScore')}</option>
          {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}/5</option>)}
        </select>
        <button type="submit" disabled={pending || !note.trim()}
          className="min-h-11 flex-1 rounded-xl bg-action-primary px-4 text-sm font-semibold text-white disabled:opacity-40">
          {t(pending ? 'common.saving' : 'common.save')}
        </button>
        <button type="button" disabled={pending} onClick={() => update({ open: false })}
          className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm">{t('common.cancel')}</button>
      </div>
      {error && <div role="alert" className="text-sm text-red-600"><p>{error}</p>
        <button type="button" onClick={onRetry} disabled={pending} className="mt-2 underline">{t('access.refresh')}</button></div>}
    </form>}
  </div>
}

export function PracticeHistory({ attempts, userId, loading, failed, onRetry, recordingBusy, canEdit, onPractice, onSave, preferredLanguages = [] }: {
  attempts: LearnerAttempt[]; userId?: string; loading: boolean; failed: boolean; onRetry: () => void
  recordingBusy: boolean; canEdit: boolean; onPractice: () => void
  onSave: (payload: FeedbackPayload) => Promise<unknown>
  /** Sound languages to list first in the feedback picker (the viewer's native and fluent languages). */
  preferredLanguages?: readonly string[]
}) {
  const { t, language } = useI18n()
  const [filter, setFilter] = useState<'all' | 'mine' | 'partner'>('all')
  const [count, setCount] = useState(5)
  const [target, setTarget] = useState('')
  // Filters and pagination can unmount rows; keep drafts and in-flight locks per attempt.
  const [drafts, setDrafts] = useState<Record<string, FeedbackDraft>>({})
  const sorted = useMemo(() => [...attempts].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt) || b.id.localeCompare(a.id)), [attempts])
  useEffect(() => {
    const read = () => {
      const match = window.location.hash.match(/^#attempt-([A-Za-z0-9-]+)$/)
      setTarget(match?.[1] ?? '')
      if (match) { setFilter('all'); setCount(5) }
    }
    read(); window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const targetIndex = sorted.findIndex(attempt => attempt.id === target)
  const visibleCount = target && filter === 'all' ? Math.max(count, targetIndex + 1) : count
  const filtered = sorted.filter(attempt => filter === 'all' || (filter === 'mine' ? attempt.learnerId === userId : attempt.learnerId !== userId))
  useEffect(() => {
    if (!target || targetIndex < 0 || filter !== 'all') return
    const node = document.getElementById('attempt-' + target)
    node?.scrollIntoView({ block: 'center' })
    node?.focus({ preventScroll: true })
  }, [target, targetIndex, filter])
  return <section className="rounded-2xl border border-gray-100 bg-surface p-5">
    <h2 className="text-sm font-bold text-gray-900">{t('study.cardDetail.attempts')}</h2>
    <div role="group" aria-label={t('history.filter')} className="my-3 flex flex-wrap gap-2">
      {(['all', 'mine', 'partner'] as const).map(value => <button key={value} type="button"
        aria-pressed={filter === value} onClick={() => { setFilter(value); setCount(5) }}
        className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${filter === value ? 'bg-action-primary text-white' : 'border border-gray-200 text-gray-700'}`}>
        {t(`history.${value}`)}
      </button>)}
    </div>
    {failed && <QueryError onRetry={onRetry} />}
    {failed && attempts.length === 0 ? null : loading ? <p role="status">{t('common.loading')}</p> : <>
      {target && targetIndex < 0 && <p role="status" className="mb-3 text-sm text-gray-600">{t('history.missing')}</p>}
      {filtered.length === 0 ? <p className="text-sm text-gray-500">{t('study.cardDetail.noAttempts')}</p> :
        <div className="space-y-3">{filtered.slice(0, visibleCount).map(attempt =>
          <article key={attempt.id} id={'attempt-' + attempt.id} tabIndex={-1}
            aria-label={t(attempt.learnerId === userId ? 'history.mine' : 'history.partner') + ' · ' + formatDate(attempt.attemptedAt, language)}
            className={`scroll-mt-6 rounded-xl border p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${target === attempt.id ? 'border-blue-400' : 'border-gray-100'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-700">{t(attempt.learnerId === userId ? 'history.mine' : 'history.partner')}</p>
              <StudyScore score={attempt.score} />
            </div>
            <p className="mt-1 text-xs text-gray-500">{formatDate(attempt.attemptedAt, language)}</p>
            <div className="mt-3"><StudyAudioPlayer attemptId={attempt.audioUrl ? attempt.id : undefined}
              label={t(attempt.learnerId === userId ? 'history.mine' : 'history.partner')} /></div>
            {attempt.correctionNote && <div className="mt-3 rounded-xl bg-blue-50 p-3">
              <p className="whitespace-pre-wrap text-sm text-gray-700">{attempt.correctionNote}</p>
              <p className="mt-2 text-xs text-gray-500">
                {attempt.correctionAuthorId === userId ? t('feedback.byMe') : attempt.correctionAuthorId ? t('feedback.byPartner') : t('feedback.unknownAuthor')}
                {' · '}{t(attempt.correctionUpdatedAt ? 'feedback.updated' : 'feedback.legacy')}
                {' · '}{formatDate(attempt.correctionUpdatedAt ?? attempt.attemptedAt, language)}
              </p>
              <FeedbackSoundTargets guideIds={(attempt.soundTargets ?? []).map(target => target.guideId)} />
            </div>}
            {attempt.learnerId === userId && attempt.correctionNote && <button type="button" disabled={recordingBusy}
              onClick={onPractice} className="mt-3 min-h-11 rounded-xl bg-action-primary px-4 text-sm font-semibold text-white disabled:opacity-40">
              {t('study.retryWithFeedback')}
            </button>}
            {canEdit && <FeedbackEditor attempt={attempt} onSave={onSave} onRetry={onRetry} preferredLanguages={preferredLanguages}
              draft={drafts[attempt.id] ?? initialFeedbackDraft(attempt)}
              update={patch => setDrafts(current => ({ ...current, [attempt.id]: {
                ...(current[attempt.id] ?? initialFeedbackDraft(attempt)), ...patch,
              } }))} />}
          </article>
        )}</div>}
      {filtered.length > visibleCount && <button type="button" onClick={() => setCount(visibleCount + 5)}
        className="mt-4 min-h-11 w-full rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">{t('feedback.more')}</button>}
    </>}
  </section>
}
