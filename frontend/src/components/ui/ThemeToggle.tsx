'use client'

import { type ThemePreference, useTheme } from '@/components/theme/ThemeProvider'
import { useI18n } from '@/i18n/I18nProvider'

const OPTIONS: { value: ThemePreference; labelKey: 'settings.themeSystem' | 'settings.themeLight' | 'settings.themeDark'; icon: string }[] = [
  { value: 'system', labelKey: 'settings.themeSystem', icon: '🖥️' },
  { value: 'light', labelKey: 'settings.themeLight', icon: '☀️' },
  { value: 'dark', labelKey: 'settings.themeDark', icon: '🌙' },
]

/**
 * system/light/dark 3-way 세그먼트 토글. 저장된 선호가 없으면 dark가 기본이지만
 * 사용자는 언제든 system(OS 따름)·light로 바꿀 수 있다.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme()
  const { t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t('settings.theme')}
      className={`inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 ${className}`}
    >
      {OPTIONS.map((option) => {
        const selected = preference === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            aria-pressed={selected}
            title={t(option.labelKey)}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors ${
              selected ? 'bg-surface shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span aria-hidden>{option.icon}</span>
            <span className="sr-only">{t(option.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
