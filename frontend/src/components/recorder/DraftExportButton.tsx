'use client'

import { useQuery } from '@tanstack/react-query'
import { useI18n } from '@/i18n/I18nProvider'
import { languageDisplayName, type MessageKey } from '@/i18n/messages'
import { api } from '@/lib/api'
import type { EditorValue } from '@/lib/composeEditorDraft'
import type { Friend, LanguageVariant } from '@/types'
import { useAuthStore } from '@/stores/authStore'

const goals: Record<string, MessageKey> = { '발음': 'goal.pronunciation', '문법': 'goal.grammar', '자연스러움': 'goal.naturalness', '억양': 'goal.intonation', '캐주얼': 'goal.casual', '비즈니스': 'goal.business' }
export function downloadDraftBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = name
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
}
export function audioExtension(type: string) {
  const mime = type.split(';')[0].trim().toLowerCase()
  return mime === 'audio/mp4' ? 'm4a' : mime === 'audio/ogg' ? 'ogg' : mime === 'audio/wav' ? 'wav' : 'webm'
}
export function DraftExportButton({ value }: { value: EditorValue }) {
  const { t, language } = useI18n()
  const authenticated = !!useAuthStore(s => s.accessToken)
  const { data: friends = [] } = useQuery<Friend[]>({ queryKey: ['friends'], queryFn: () => api.get('/friends').then(r => r.data), enabled: authenticated && value.destination === 'FRIEND' })
  const { data: variants } = useQuery<Record<string, LanguageVariant[]>>({ queryKey: ['language-variants'], queryFn: () => api.get('/languages/variants').then(r => r.data), enabled: authenticated && !!value.targetVariant, staleTime: 300000 })
  const download = () => {
    const now = new Date()
    const missing = t('drafts.unspecified')
    const lines = [
      `ToneBridge — ${t('drafts.editor')}`,
      `${t('drafts.exported')}: ${new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'long' }).format(now)}`,
      `${t('request.contentLabel')}: ${value.contentText || missing}`,
      `${t('request.context')}: ${value.context || missing}`,
      `${t('request.stepDestination')}: ${t(value.destination === 'COMMUNITY' ? 'request.destinationCommunity' : value.destination === 'FRIEND' ? 'request.destinationFriend' : 'request.destinationPersonal')}`,
    ]
    if (value.destination === 'FRIEND') lines.push(`${t('study.selectFriend')}: ${value.selectedFriendId ? friends.find(f => f.id === value.selectedFriendId)?.username ?? t('drafts.unknownFriend') : missing}`)
    const variant = variants?.[value.targetLanguage]?.find(v => v.code === value.targetVariant)
    lines.push(`${t('request.language')}: ${value.targetLanguage ? languageDisplayName(value.targetLanguage, language) : missing}${value.targetVariant ? ` — ${variant?.labelNative || variant?.label || languageDisplayName(value.targetVariant, language)}` : ''}`,
      `${t('request.stepFeedback')}: ${value.selectedGoals.length ? value.selectedGoals.map(g => goals[g] ? t(goals[g]) : g).join(', ') : missing}`)
    downloadDraftBlob(new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' }), `tonebridge-draft-${now.toISOString().replace(/[:.]/g, '-')}.txt`)
  }
  return <button type="button" onClick={download} className="min-h-11 underline">{t('editor.download')}</button>
}
