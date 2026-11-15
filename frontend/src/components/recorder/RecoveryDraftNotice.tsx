import Link from 'next/link'
import { useI18n } from '@/i18n/I18nProvider'
import type { DraftStorageIssue } from '@/lib/draftStorageError'
import { downloadDraftBlob } from './DraftExportButton'

export function RecoveryDraftNotice({ value, status, issue, restored, pending, busy, onRetry, onEdit }: {
  value: unknown; status: 'empty' | 'saving' | 'saved' | 'error'; issue: DraftStorageIssue | null
  restored: boolean; pending: boolean; busy: boolean; onRetry: () => void; onEdit: () => void
}) {
  const { t } = useI18n()
  if (status === 'empty' && !restored && !pending && !issue) return null
  return <aside data-testid="recovery-draft" className="space-y-2 rounded-xl border border-gray-200 bg-surface p-3 text-sm">
    {issue ? <p role="alert">{t('compose.storageError')} {t(`editor.${issue}`)} {t('editor.keepOpen')}</p>
      : <p role="status">{t(pending ? 'recovery.pending' : status === 'saving' ? 'editor.saving' : restored ? 'editor.restored' : 'editor.saved')}</p>}
    <details><summary className="cursor-pointer py-2">{t('drafts.details')}</summary><p>{t('editor.retention')}</p>
      <button type="button" className="min-h-11 underline" onClick={() => downloadDraftBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), 'tonebridge-feedback.json')}>{t('editor.download')}</button>
      <Link href="/drafts" className="ml-4 inline-block min-h-11 py-2 underline">{t('drafts.title')}</Link>
    </details>
    {issue && <button type="button" disabled={busy} onClick={onRetry} className="min-h-11 underline">{t('editor.retry')}</button>}
    {pending && <button type="button" disabled={busy} onClick={onEdit} className="min-h-11 underline">{t('recovery.edit')}</button>}
  </aside>
}
