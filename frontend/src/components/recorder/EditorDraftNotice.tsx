'use client'

import { useI18n } from '@/i18n/I18nProvider'
import type { EditorValue } from '@/lib/composeEditorDraft'
import type { DraftStorageIssue } from '@/lib/draftStorageError'

export function EditorDraftNotice({ value, status, issue, restored, audioUrl, audioType, disabled, onRetry }: {
  value: EditorValue; status: 'empty' | 'saving' | 'saved' | 'error'; issue: DraftStorageIssue | null
  restored: boolean; audioUrl: string | null; audioType?: string; disabled: boolean; onRetry: () => void
}) {
  const { t } = useI18n()
  const extension = audioType === 'audio/mp4' ? 'm4a' : audioType === 'audio/ogg' ? 'ogg' : 'webm'
  const download = () => {
    const text = [
      `${t('request.contentLabel')}: ${value.contentText}`, `${t('request.context')}: ${value.context}`,
      `${t('request.stepDestination')}: ${t(value.destination === 'COMMUNITY' ? 'request.destinationCommunity' : value.destination === 'FRIEND' ? 'request.destinationFriend' : 'request.destinationPersonal')}`,
      `${t('study.selectFriend')}: ${value.selectedFriendId}`, `${t('request.language')}: ${value.targetLanguage} ${value.targetVariant ?? ''}`,
      `${t('request.stepFeedback')}: ${value.selectedGoals.join(', ')}`,
    ].join('\n\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'tonebridge-draft.txt'
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
  if (status === 'empty' && !issue) return null
  return <aside data-testid="editor-draft" className="space-y-2 rounded-xl border border-gray-200 bg-surface p-3 text-xs text-gray-700">
    {issue ? <p role="alert">{t('compose.storageError')} {t(`editor.${issue}`)} {t('editor.keepOpen')}</p>
      : <p role="status">{t(status === 'saving' ? 'editor.saving' : restored ? 'editor.restored' : 'editor.saved')}</p>}
    {!issue && <p>{t('editor.retention')}</p>}
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {issue && <button type="button" disabled={disabled} onClick={onRetry} className="min-h-11 font-semibold underline">{t('editor.retry')}</button>}
      <button type="button" onClick={download} className="min-h-11 underline">{t('editor.download')}</button>
      {audioUrl && <a href={audioUrl} download={`recording.${extension}`} className="inline-flex min-h-11 items-center underline">{t('recording.download')}</a>}
    </div>
  </aside>
}
