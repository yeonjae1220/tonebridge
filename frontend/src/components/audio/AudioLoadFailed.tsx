'use client'

import { useI18n } from '@/i18n/I18nProvider'

/** 오디오 URL 조회 실패 안내 + 재시도. 실패가 '재생 버튼이 계속 비활성'으로만 보이지 않게 한다. */
export function AudioLoadFailed({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { t } = useI18n()
  if (!failed) return null
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2">
      <span className="text-xs text-red-700">{t('error.unexpected')}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
      >
        {t('common.retry')}
      </button>
    </div>
  )
}
