'use client'

import type { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useI18n } from '@/i18n/I18nProvider'
import Link from 'next/link'
import { audioExtension } from './DraftExportButton'

export function RecordingDraftNotice({ recorder }: { recorder: ReturnType<typeof useAudioRecorder> }) {
  const { t } = useI18n()
  const { draftStatus, restored, interrupted, state, audioUrl, audioBlob } = recorder
  if (draftStatus === 'empty' && state !== 'recording') return null
  const message = draftStatus === 'loading' ? 'recording.restoreLoading'
    : draftStatus === 'error' ? 'recording.localError'
      : state === 'recording' ? 'recording.checkpoint'
        : draftStatus === 'saving' ? 'recording.localSaving'
          : restored ? 'recording.restored' : 'recording.draft'
  const extension = audioExtension(audioBlob?.type ?? '')
  return <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600" data-testid="draft-notice">
    <p role={draftStatus === 'error' ? 'alert' : 'status'}>{t(message)}</p>
    {restored && interrupted && <p>{t('recording.interrupted')}</p>}
    <details key={draftStatus === 'error' ? 'error' : restored ? 'restored' : 'normal'} open={draftStatus === 'error' || restored || interrupted}>
    <summary className="min-h-11 cursor-pointer py-3 font-medium">{t('drafts.details')}</summary>
    {(audioBlob || state === 'recording') && <p>{t('recording.retention')}</p>}
    {draftStatus === 'error' && <button type="button" onClick={recorder.retryDraft} className="min-h-11 rounded-lg border px-3 font-semibold">{t('recording.localRetry')}</button>}
    {audioUrl && <div className="flex flex-wrap gap-3">
      <a href={audioUrl} download={`recording.${extension}`} className="inline-flex min-h-11 items-center underline">{t('recording.download')}</a>
      <button type="button" className="min-h-11 underline" onClick={() => { if (window.confirm(t('recording.discardDraftConfirm'))) recorder.reset() }}>{t('recording.discardDraft')}</button>
    </div>}
    <Link href="/drafts" className="inline-flex min-h-11 items-center underline">{t('drafts.title')}</Link>
    </details>
  </div>
}
