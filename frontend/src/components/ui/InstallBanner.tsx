'use client'

import { useState } from 'react'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { useI18n } from '@/i18n/I18nProvider'
import { Dialog } from './Dialog'

export function InstallBanner({ className = '', persistent = false, onDismiss }: { className?: string; persistent?: boolean; onDismiss?: () => void }) {
  const { installPrompt, isInstalled, platform, triggerInstall } = usePWAInstall()
  const { t } = useI18n()
  const [guide, setGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [failed, setFailed] = useState(false)
  const [installing, setInstalling] = useState(false)
  if ((isInstalled || dismissed) && !persistent) return null
  return <>
    <section className={`rounded-2xl border border-gray-200 bg-surface p-4 text-gray-900 ${className}`} aria-label={t('access.install')}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{t('access.install')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t(isInstalled ? 'access.installed' : 'access.installHelp')}</p></div>
        {!isInstalled && <button type="button" disabled={installing} onClick={async () => {
          setFailed(false)
          if (!installPrompt) { setGuide(true); return }
          setInstalling(true)
          try { await triggerInstall() } catch { setFailed(true); setGuide(true) } finally { setInstalling(false) }
        }} className="min-h-11 rounded-xl bg-action-primary px-4 text-sm font-semibold text-white disabled:opacity-40">
          {t(installPrompt ? 'access.install' : 'access.installGuide')}
        </button>}
        {!persistent && <button type="button" aria-label={t('common.close')} onClick={() => { setDismissed(true); onDismiss?.() }} className="h-11 w-11 text-gray-500">×</button>}
      </div>
    </section>
    {guide && <Dialog title={t('access.installGuide')} onClose={() => setGuide(false)}>
      {failed && <p role="alert" className="mb-3 text-red-500">{t('access.installFailed')}</p>}
      <p className="leading-relaxed">{t(platform === 'ios' ? 'access.iosGuide' : 'access.browserGuide')}</p>
      <p className="mt-4 text-sm text-gray-500">{t('access.online')}</p>
    </Dialog>}
  </>
}
