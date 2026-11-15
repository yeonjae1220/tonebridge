import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRecoveryDraft } from '@/hooks/useRecoveryDraft'
import { useCardSubmission, type SavedCard } from '@/hooks/useCardSubmission'
import { validCardDraft, type CardDraftValue } from '@/lib/feedbackDraft'
import { QueryError } from '@/components/ui/QueryError'
import { Dialog } from '@/components/ui/Dialog'
import { RecoveryDraftNotice } from '@/components/recorder/RecoveryDraftNotice'
import { useI18n } from '@/i18n/I18nProvider'
import { getApiErrorMessage } from '@/lib/apiError'
import { WriteOutcomeUnknownError } from '@/lib/writeDeadline'

export function CardCreateSheet({ sessionId, onClose, onSaved }: { sessionId: string; onClose: () => void; onSaved: (card: SavedCard) => void }) {
  const { data: user, isError: userError, isFetching: userFetching, refetch: refetchUser } = useCurrentUser()
  const { t } = useI18n()
  const draft = useRecoveryDraft<CardDraftValue>(user?.id, `card-new:${sessionId}`, {
    kind: 'card', sessionId, phrase: '', context: '', tags: [], tagText: '',
  }, validCardDraft)
  const mutation = useCardSubmission(draft, onSaved)
  const locked = mutation.isPending || !draft.ready || !!draft.pending
  return <Dialog title={t('study.cards.new')} busy={mutation.isPending} onClose={() => { if (draft.status !== 'error' || window.confirm(t('editor.leave'))) onClose() }}>
    <form className="flex flex-col gap-4" onSubmit={event => {
      event.preventDefault()
      if (!mutation.isPending && draft.ready && !draft.issue && (draft.pending || draft.value.phrase.trim())) mutation.mutate('save')
    }}>
      {!user && (userError ? <QueryError retrying={userFetching} onRetry={() => void refetchUser()} /> : <p role="status">{t('common.loading')}</p>)}
      <RecoveryDraftNotice value={draft.value} status={draft.status} issue={draft.issue} restored={draft.restored}
        pending={!!draft.pending} busy={mutation.isPending} onRetry={() => void draft.retry()} onEdit={() => mutation.mutate('edit')} />
      <fieldset disabled={locked} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1"><span>{t('study.cards.phrase')}</span>
          <textarea autoFocus rows={3} maxLength={500} value={draft.value.phrase} onChange={e => draft.setValue(v => ({ ...v, phrase: e.target.value }))} className="rounded-xl border p-3" /></label>
        <label className="flex flex-col gap-1"><span>{t('study.cards.context')}</span>
          <input maxLength={10000} value={draft.value.context} onChange={e => draft.setValue(v => ({ ...v, context: e.target.value }))} className="rounded-xl border p-3" /></label>
        <label className="flex flex-col gap-1"><span>{t('study.cards.tags')}</span>
          <input maxLength={2200} value={draft.value.tagText ?? draft.value.tags.join(', ')} onChange={e => {
            const tagText = e.target.value
            draft.setValue(v => ({ ...v, tagText, tags: tagText.split(',').map(tag => tag.trim()).filter(Boolean) }))
          }} placeholder={t('study.cards.tagsPlaceholder')} className="rounded-xl border p-3" /></label>
      </fieldset>
      {mutation.isError && <p role="alert" className="text-sm text-red-600">{getApiErrorMessage(mutation.error, t(mutation.error instanceof WriteOutcomeUnknownError ? 'common.saveUncertain' : 'error.unexpected'))}</p>}
      <button type="submit" disabled={mutation.isPending || !draft.ready || !!draft.issue || (!draft.pending && !draft.value.phrase.trim())}
        className="w-full rounded-xl bg-action-primary py-3 font-semibold text-white disabled:opacity-40">{t(mutation.isPending ? 'common.saving' : 'common.save')}</button>
    </form>
  </Dialog>
}
