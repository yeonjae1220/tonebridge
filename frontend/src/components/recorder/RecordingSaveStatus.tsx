import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'

export function RecordingSaveStatus({ pending, stage }: { pending: boolean; stage?: 'preparing' | 'uploading' | 'saving' }) {
  const { t } = useI18n()
  const [slow, setSlow] = useState(false)
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    setSlow(false)
    const update = () => setOffline(!navigator.onLine)
    update()
    if (!pending) return
    const timer = setTimeout(() => setSlow(true), 5000)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { clearTimeout(timer); window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [pending])
  if (!pending) return null
  return <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800" aria-live="polite">
    {t(offline ? 'recording.offline' : slow ? 'recording.slow' : stage === 'uploading' ? 'recording.uploading' : stage === 'saving' ? 'recording.saving' : 'recording.preparing')}
  </p>
}
