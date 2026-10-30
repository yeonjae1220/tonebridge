'use client'

import { useI18n } from '@/i18n/I18nProvider'

export function QueryError({ onRetry, retrying = false }: { onRetry: () => void; retrying?: boolean }) {
  const { t } = useI18n()
  return (
    <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <p>{t('error.unexpected')}</p>
      <button type="button" onClick={onRetry} disabled={retrying}
        className="mt-3 min-h-11 rounded-xl bg-action-neutral px-4 font-semibold text-action-neutral-foreground disabled:opacity-40">
        {retrying ? t('common.loading') : t('common.retry')}
      </button>
    </div>
  )
}
