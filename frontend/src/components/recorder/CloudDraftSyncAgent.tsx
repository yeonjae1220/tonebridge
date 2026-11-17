'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { selectCloudRecording, syncCloudRecordings } from '@/lib/cloudAudioSync'
import { recordingDrafts } from '@/lib/recordingDrafts'
import { cachedCloudSettings } from '@/lib/cloudDraftLocal'
import { useCloudOwner } from '@/hooks/useCloudOwner'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n/I18nProvider'
import { cloudBindings, cloudMetadataFailed, expireLocalCloudValues, onCloudChange } from '@/lib/cloudDraftLocal'
import { startCloudSession, synchronizeAllCloudDrafts } from '@/lib/cloudDraftSync'

export function CloudDraftSyncAgent() {
  const { data: me } = useCloudOwner()
  const generation = useAuthStore(s => s.sessionGeneration)
  const { t } = useI18n()
  const [, changed] = useState(0)
  useEffect(() => {
    if (!me?.id) return
    const owner = me.id, stop = startCloudSession(owner, generation)
    let timer: ReturnType<typeof setTimeout> | undefined
    let mounted = true
    const sync = (retry = false) => {
      try { expireLocalCloudValues(owner) } catch { /* Manager reports metadata failure and preserves local drafts. */ }
      void syncCloudRecordings(owner, retry).then(() => synchronizeAllCloudDrafts(owner, retry)).catch(() => {}).finally(() => { if (mounted) changed(v => v + 1) })
    }
    const update = () => { changed(v => v + 1); clearTimeout(timer); timer = setTimeout(() => sync(), 1000) }
    const reconnect = () => sync(true)
    const completed = (event: Event) => {
      const detail = (event as CustomEvent<{ owner: string; scope: string; id: string }>).detail
      const settings = cachedCloudSettings(owner)
      if (detail.owner !== owner || !settings?.audioEnabled || !settings.enabled) return
      void recordingDrafts.list(owner).then(async rows => {
        const source = rows.find(row => row.scope === detail.scope && row.id === detail.id)
        if (source) await selectCloudRecording(owner, source, settings)
      }).catch(() => {})
    }
    window.addEventListener('tonebridge-recording-complete', completed)
    const unsubscribe = onCloudChange(update)
    window.addEventListener('online', reconnect); window.addEventListener('focus', reconnect); window.addEventListener('storage', update)
    const interval = setInterval(() => { if (document.visibilityState === 'visible') sync() }, 60000)
    sync()
    return () => { mounted = false; window.removeEventListener('tonebridge-recording-complete', completed); stop(); clearTimeout(timer); clearInterval(interval); unsubscribe(); window.removeEventListener('online', reconnect); window.removeEventListener('focus', reconnect); window.removeEventListener('storage', update) }
  }, [me?.id, generation])
  let error = false
  if (me?.id) {
    try { error = cloudMetadataFailed() || Object.values(cloudBindings(me.id)).some(row => !!row.error) } catch { error = true }
  }
  return error ? <aside role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"><Link href="/drafts/cloud">{t('cloud.attention')}</Link></aside> : null
}
