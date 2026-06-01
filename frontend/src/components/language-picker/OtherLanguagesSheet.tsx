'use client'

import { useState } from 'react'
import { OTHER_LANGUAGES, type Language } from '@/constants/languages'
import { useI18n } from '@/i18n/I18nProvider'
import { languageDisplayName } from '@/i18n/messages'

interface OtherLanguagesSheetProps {
  onSelect: (lang: Language) => void
  onClose: () => void
}

export function OtherLanguagesSheet({ onSelect, onClose }: OtherLanguagesSheetProps) {
  const { language, t } = useI18n()
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? OTHER_LANGUAGES.filter((l) => languageDisplayName(l.code, language).toLowerCase().includes(query.trim().toLowerCase()))
    : OTHER_LANGUAGES

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-surface rounded-t-3xl max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-bold text-gray-900">{t('language.otherTitle')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label={t('language.close')}
          >
            ✕
          </button>
        </div>

        <div className="px-5 pb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('language.searchPlaceholder')}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
        </div>

        <div className="overflow-y-auto px-5 pb-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('language.noSearchResults')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => onSelect(lang)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                >
                  {lang.flag && <span className="text-xl">{lang.flag}</span>}
                  <span className="text-sm font-medium text-gray-800">{languageDisplayName(lang.code, language)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
