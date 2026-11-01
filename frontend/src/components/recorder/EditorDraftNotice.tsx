'use client'

import { useI18n } from '@/i18n/I18nProvider'
import type { EditorValue } from '@/lib/composeEditorDraft'
import type { DraftStorageIssue } from '@/lib/draftStorageError'
import Link from 'next/link'
import { DraftExportButton, audioExtension } from './DraftExportButton'

export function EditorDraftNotice({ value, status, issue, restored, audioUrl, audioType, disabled, onRetry }: {
  value: EditorValue; status: 'empty' | 'saving' | 'saved' | 'error'; issue: DraftStorageIssue | null
  restored: boolean; audioUrl: string | null; audioType?: string; disabled: boolean; onRetry: () => void
}) {
  const { t } = useI18n()
  const extension = audioExtension(audioType ?? '')
  if (status === 'empty' && !issue) return null
  return <aside data-testid="editor-draft" className="space-y-2 rounded-xl border border-gray-200 bg-surface p-3 text-xs text-gray-700">
    {issue ? <p role="alert">{t('compose.storageError')} {t(`editor.${issue}`)} {t('editor.keepOpen')}</p>
      : <p role="status">{t(status === 'saving' ? 'editor.saving' : restored ? 'editor.restored' : 'editor.saved')}</p>}
    <details key={issue ?? (restored ? 'restored' : 'normal')} open={!!issue || restored}>
      <summary className="min-h-11 cursor-pointer py-3 font-medium">{t('drafts.details')}</summary>
      {!issue && <p>{t('editor.retention')}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
      {issue && <button type="button" disabled={disabled} onClick={onRetry} className="min-h-11 font-semibold underline">{t('editor.retry')}</button>}
      <DraftExportButton value={value} />
      {audioUrl && <a href={audioUrl} download={`recording.${extension}`} className="inline-flex min-h-11 items-center underline">{t('recording.download')}</a>}
      <Link href="/drafts" className="inline-flex min-h-11 items-center underline">{t('drafts.title')}</Link>
      </div>
    </details>
  </aside>
}
