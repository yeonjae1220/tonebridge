'use client'

import { UI_LANGUAGES } from '@/constants/languages'
import { useI18n } from '@/i18n/I18nProvider'
import { languageDisplayName } from '@/i18n/messages'

/**
 * 비로그인 사용자도 랜딩에서 UI 언어를 바꿀 수 있는 경량 스위처.
 * 네이티브 <select>라 키보드/스크린리더 접근성이 기본 보장된다.
 */
export function UiLanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, setLanguage, t } = useI18n()

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t('settings.uiLanguage')}</span>
      <span aria-hidden className="pointer-events-none absolute left-2.5 text-sm">🌐</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="appearance-none rounded-lg border border-gray-200 bg-surface pl-8 pr-7 py-1.5 text-sm text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {UI_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {languageDisplayName(lang.code, language)}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2.5 text-xs text-gray-400">▾</span>
    </label>
  )
}
