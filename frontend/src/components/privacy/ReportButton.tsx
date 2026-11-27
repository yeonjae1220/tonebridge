'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '@/lib/api'
import { withWriteDeadline, WriteOutcomeUnknownError } from '@/lib/writeDeadline'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { Dialog } from '@/components/ui/Dialog'

/** Matches backend `ContentReportService.TargetType`; the server resolves the author. */
export type ReportTarget = 'USER' | 'CARD' | 'NATIVE_AUDIO' | 'ATTEMPT_FEEDBACK' | 'CORRECTION_REQUEST' | 'CORRECTION'
export const REPORT_REASONS = ['SPAM', 'HARASSMENT', 'HATE', 'SEXUAL', 'VIOLENCE', 'ILLEGAL', 'OTHER'] as const
type ReportReason = typeof REPORT_REASONS[number]
const DETAIL_MAX = 500

type Props = {
  target: ReportTarget
  targetId?: string | null
  /** The author, used only to hide the button on the viewer's own content. */
  authorId?: string | null
}

export function ReportButton(props: Props) {
  const generation = useAuthStore(s => s.sessionGeneration)
  return <ReportAction key={`${generation}:${props.target}:${props.targetId}`} {...props} />
}

function errorKey(error: unknown) {
  if (error instanceof WriteOutcomeUnknownError) return 'common.actionUncertain' as const
  const code = axios.isAxiosError(error) ? (error.response?.data as { code?: string } | undefined)?.code : undefined
  if (code === 'REPORT_001') return 'report.gone' as const
  if (code === 'REPORT_002') return 'report.own' as const
  if (code === 'REPORT_003') return 'report.limit' as const
  return 'error.unexpected' as const
}

function ReportAction({ target, targetId, authorId }: Props) {
  const { data: me } = useCurrentUser()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  const mounted = useRef(true)
  const generation = useAuthStore(s => s.sessionGeneration)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const mutation = useMutation({
    mutationFn: () => withWriteDeadline(signal => api.post('/reports', {
      targetType: target, targetId, reason, alsoBlock,
      ...(detail.trim() ? { detail: detail.trim() } : {}),
    }, { signal })),
    onSuccess: () => {
      // A block closes shared notebooks; reload like BlockUserButton so no stale peer data stays on screen.
      if (alsoBlock && mounted.current && generation === useAuthStore.getState().sessionGeneration) window.location.assign('/friends')
    },
    onError: () => {},
  })
  if (!targetId || !me) return null
  if (authorId && authorId === me.id) return null
  if (target === 'USER' && targetId === me.id) return null
  const close = () => { setOpen(false); setReason(null); setDetail(''); setAlsoBlock(false); mutation.reset() }
  const title = t(target === 'USER' ? 'report.titleUser' : 'report.titleContent')
  return <div onClick={event => event.stopPropagation()}>
    <button type="button" onClick={() => { mutation.reset(); setOpen(true) }} className="min-h-11 px-2 text-sm text-gray-600">{t('report.button')}</button>
    {open && <Dialog title={title} busy={mutation.isPending} onClose={close}>
      {mutation.isSuccess ? <>
        <p role="status" className="mb-4 text-sm">{t('report.sent')}</p>
        <button type="button" onClick={close} className="min-h-11 rounded-xl bg-gray-900 px-4 text-white">{t('common.close')}</button>
      </> : <form onSubmit={event => { event.preventDefault(); if (reason) mutation.mutate() }}>
        <fieldset disabled={mutation.isPending} className="flex flex-col gap-1">
          <legend className="mb-2 text-sm">{t('report.prompt')}</legend>
          {REPORT_REASONS.map(value => <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="report-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
            {t(`report.reason.${value}`)}
          </label>)}
          <label className="mt-2 text-sm">
            <span className="mb-1 block">{t('report.detail')}</span>
            <textarea value={detail} maxLength={DETAIL_MAX} rows={3} onChange={event => setDetail(event.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={alsoBlock} onChange={event => setAlsoBlock(event.target.checked)} />
            {t('report.alsoBlock')}
          </label>
        </fieldset>
        {mutation.isError && <p role="alert" className="my-3 text-sm text-red-700">{t(errorKey(mutation.error))}</p>}
        <button type="submit" disabled={!reason || mutation.isPending} className="mt-3 min-h-11 rounded-xl bg-red-700 px-4 text-white disabled:opacity-40">
          {t(mutation.isPending ? 'common.saving' : 'report.submit')}
        </button>
      </form>}
    </Dialog>}
  </div>
}
