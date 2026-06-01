'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { LanguageVariant } from '@/types'
import { ALL_LANG_LABELS } from '@/constants/languages'
import { useI18n } from '@/i18n/I18nProvider'
import { formatMessage, languageDisplayName } from '@/i18n/messages'

interface DialectSheetProps {
  languageCode: string
  selectedVariant: string | null
  onSelect: (variant: string | null) => void
  onClose: () => void
}

const VARIANT_TYPE_LABELS = {
  DIALECT: 'language.type.dialect',
  ACCENT: 'language.type.accent',
  SCRIPT: 'language.type.script',
} as const

export function DialectSheet({ languageCode, selectedVariant, onSelect, onClose }: DialectSheetProps) {
  const { language, t } = useI18n()
  const { data: variantsMap, isLoading, isError } = useQuery<Record<string, LanguageVariant[]>>({
    queryKey: ['language-variants'],
    queryFn: () => api.get('/languages/variants').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const variants = variantsMap?.[languageCode] ?? []
  const langLabel = languageDisplayName(languageCode, language) || (ALL_LANG_LABELS[languageCode] ?? languageCode)

  const grouped = variants.reduce<Record<string, LanguageVariant[]>>((acc, v) => {
    const key = v.variantType
    return { ...acc, [key]: [...(acc[key] ?? []), v] }
  }, {})

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-surface rounded-t-3xl max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-bold text-gray-900">
            {formatMessage(t('language.variantTitle'), { language: langLabel })}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label={t('language.close')}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 flex flex-col gap-4">
          {/* 표준어 option */}
          <button
            onClick={() => onSelect(null)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
              selectedVariant === null
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            <span className="text-sm font-semibold">{t('language.standard')}</span>
            {selectedVariant === null && <span className="text-blue-500">✓</span>}
          </button>

          {isLoading && (
            <div className="py-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
          )}

          {isError && (
            <p className="text-sm text-red-400 text-center py-4">
              {t('language.variantLoadFailed')}
            </p>
          )}

          {!isLoading && !isError && variants.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              {t('language.noVariants')}
            </p>
          )}

          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {type in VARIANT_TYPE_LABELS ? t(VARIANT_TYPE_LABELS[type as keyof typeof VARIANT_TYPE_LABELS]) : type}
              </p>
              <div className="flex flex-col gap-2">
                {items.map((v) => (
                  <button
                    key={v.code}
                    onClick={() => onSelect(v.code)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
                      selectedVariant === v.code
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium">{v.label}</p>
                      {v.labelNative && v.labelNative !== v.label && (
                        <p className="text-xs text-gray-400 mt-0.5">{v.labelNative}</p>
                      )}
                      {v.region && (
                        <p className="text-xs text-gray-400 mt-0.5">{v.region}</p>
                      )}
                    </div>
                    {selectedVariant === v.code && <span className="text-blue-500 shrink-0 ml-2">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
