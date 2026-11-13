'use client'

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
type Platform = 'ios' | 'other'
type InstallState = { dismissSuggestion: () => void; suggestInstall: () => void; suggested: boolean; installPrompt: BeforeInstallPromptEvent | null; isInstalled: boolean; platform: Platform; triggerInstall: () => Promise<void> }
const InstallContext = createContext<InstallState | null>(null)

/** One listener survives navigation, including direct login and invitation entry. */
export function PWAProvider({ children }: { children: ReactNode }) {
  const hasSuggested = useRef(false)
  const [suggested, setSuggested] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [platform, setPlatform] = useState<Platform>('other')
  useEffect(() => {
    const navigatorIOS = navigator as Navigator & { standalone?: boolean }
    setPlatform(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : 'other')
    const media = window.matchMedia('(display-mode: standalone)')
    const sync = () => setIsInstalled(media.matches || navigatorIOS.standalone === true)
    const installed = () => { setIsInstalled(true); setInstallPrompt(null) }
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent) }
    sync()
    media.addEventListener('change', sync)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', installed)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Installation guidance remains usable even when a browser blocks workers.
        console.warn('[pwa] Service worker registration unavailable')
      })
    }
    return () => {
      media.removeEventListener('change', sync)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])
  const triggerInstall = async () => {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      if ((await installPrompt.userChoice).outcome === 'accepted') setIsInstalled(true)
    } finally { setInstallPrompt(null) }
  }
  return <InstallContext.Provider value={{ dismissSuggestion: () => setSuggested(false), suggestInstall: () => { if (!hasSuggested.current) { hasSuggested.current = true; setSuggested(true) } }, suggested, installPrompt, isInstalled, platform, triggerInstall }}>{children}</InstallContext.Provider>
}
export function usePWAInstall() {
  const value = useContext(InstallContext)
  if (!value) throw new Error('PWAProvider required')
  return value
}
