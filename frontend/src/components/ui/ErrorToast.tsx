'use client'

import { useEffect } from 'react'
import { useErrorToastStore } from '@/stores/errorToastStore'
import { useI18n } from '@/i18n/I18nProvider'

const AUTO_DISMISS_MS = 6000

/** 화면이 따로 처리하지 않은 요청 실패를 알리는 전역 안내. 실패가 조용히 사라지지 않게 하는 안전망이다. */
export function ErrorToast() {
  const { message, visible, dismiss } = useErrorToastStore()
  const { t } = useI18n()

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [visible, message, dismiss])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 pb-[env(safe-area-inset-bottom)] pointer-events-none">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 shadow-lg"
      >
        <p className="flex-1 text-sm text-red-700">{message ?? t('error.unexpected')}</p>
        <button
          type="button"
          onClick={dismiss}
          className="text-red-400 hover:text-red-600"
          aria-label={t('common.close')}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
