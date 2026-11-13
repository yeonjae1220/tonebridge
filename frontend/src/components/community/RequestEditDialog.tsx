'use client'

import { useState, type FormEvent } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { useI18n } from '@/i18n/I18nProvider'
import type { CorrectionRequest } from '@/types'

export function RequestEditDialog({ request, pending, error, onClose, onSubmit }: {
  request: CorrectionRequest
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (payload: Partial<CorrectionRequest>) => void
}) {
  const { t } = useI18n()
  const [contentText, setContentText] = useState(request.contentText ?? '')
  const [context, setContext] = useState(request.context ?? '')
  const isAudio = request.type === 'AUDIO'
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pending || (!isAudio && !contentText.trim())) return
    onSubmit({ contentText: isAudio ? request.contentText : contentText.trim(), context: context.trim() || undefined })
  }
  return <Dialog title={t('request.editTitle')} onClose={onClose} busy={pending}>
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="flex flex-col gap-4">
        {!isAudio && <label className="flex flex-col gap-1 text-sm">{t('request.contentLabel')}
          <textarea value={contentText} onChange={e => setContentText(e.target.value)} rows={4} autoFocus
            className="w-full rounded-xl border border-gray-200 p-3 text-sm" />
        </label>}
        <label className="flex flex-col gap-1 text-sm">{t('request.context')}
          <textarea value={context} onChange={e => setContext(e.target.value)} rows={3}
            className="w-full rounded-xl border border-gray-200 p-3 text-sm" />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={pending || (!isAudio && !contentText.trim())}
          className="min-h-11 rounded-xl bg-action-primary px-4 py-3 font-semibold text-white disabled:opacity-40">
          {t(pending ? 'common.saving' : 'common.save')}
        </button>
      </fieldset>
    </form>
  </Dialog>
}
