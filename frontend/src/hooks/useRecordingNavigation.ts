'use client'

import { useEffect } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { recordingDrafts } from '@/lib/recordingDrafts'

export function useRecordingNavigation() {
  const { t } = useI18n()
  return (navigate: () => void) => {
    if (!recordingDrafts.hasUnsaved() || window.confirm(t('recording.leave'))) navigate()
  }
}

export function RecordingNavigationGuard() {
  const { t } = useI18n()
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (recordingDrafts.hasUnsaved()) { event.preventDefault(); event.returnValue = '' }
    }
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || link.hasAttribute('download') || !recordingDrafts.hasUnsaved()) return
      const target = new URL(link.href)
      if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search) return
      if (!window.confirm(t('recording.leave'))) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true) }
  }, [t])
  return null
}
