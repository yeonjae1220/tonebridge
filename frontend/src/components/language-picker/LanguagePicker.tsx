'use client'

import { useState } from 'react'
import { PRIMARY_LANGUAGES, ALL_LANG_LABELS, type Language } from '@/constants/languages'
import { OtherLanguagesSheet } from './OtherLanguagesSheet'
import { DialectSheet } from './DialectSheet'

interface LanguagePickerProps {
  value: string
  variant?: string | null
  onLanguageChange: (code: string) => void
  onVariantChange?: (variant: string | null) => void
  excludeCodes?: string[]
  showVariantPicker?: boolean
  multiSelect?: false
}

interface LanguagePickerMultiProps {
  value: string[]
  onLanguageChange: (codes: string[]) => void
  excludeCodes?: string[]
  showVariantPicker?: false
  multiSelect: true
}

type Props = LanguagePickerProps | LanguagePickerMultiProps

function isMulti(props: Props): props is LanguagePickerMultiProps {
  return props.multiSelect === true
}

export function LanguagePicker(props: Props) {
  const [showOther, setShowOther] = useState(false)
  const [showDialect, setShowDialect] = useState(false)

  const excludeCodes = props.excludeCodes ?? []
  const visiblePrimary = PRIMARY_LANGUAGES.filter((l) => !excludeCodes.includes(l.code))

  const handlePrimaryClick = (lang: Language) => {
    if (isMulti(props)) {
      const current = props.value
      props.onLanguageChange(
        current.includes(lang.code)
          ? current.filter((c) => c !== lang.code)
          : [...current, lang.code]
      )
    } else {
      props.onLanguageChange(lang.code)
      if (props.onVariantChange) props.onVariantChange(null)
    }
  }

  const handleOtherSelect = (lang: Language) => {
    setShowOther(false)
    if (isMulti(props)) {
      const current = props.value
      if (!current.includes(lang.code)) {
        props.onLanguageChange([...current, lang.code])
      }
    } else {
      props.onLanguageChange(lang.code)
      if (props.onVariantChange) props.onVariantChange(null)
    }
  }

  const isSelected = (code: string) => {
    if (isMulti(props)) return props.value.includes(code)
    return props.value === code
  }

  const selectedCode = isMulti(props) ? null : props.value
  const selectedVariant = isMulti(props) ? null : (props.variant ?? null)

  const otherSelectedCodes = isMulti(props)
    ? props.value.filter((c) => !PRIMARY_LANGUAGES.some((p) => p.code === c))
    : selectedCode && !PRIMARY_LANGUAGES.some((p) => p.code === selectedCode)
      ? [selectedCode]
      : []

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {visiblePrimary.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => handlePrimaryClick(lang)}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-medium transition-all ${
              isSelected(lang.code)
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            <span className="text-xl">{lang.flag}</span>
            <span className="text-xs">{lang.label}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowOther(true)}
          className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-medium transition-all ${
            otherSelectedCodes.length > 0
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 hover:border-gray-300 text-gray-500'
          }`}
        >
          <span className="text-xl">🌐</span>
          <span className="text-xs">
            {otherSelectedCodes.length > 0
              ? otherSelectedCodes.map((c) => ALL_LANG_LABELS[c] ?? c).join(', ')
              : '기타 언어'}
          </span>
        </button>
      </div>

      {!isMulti(props) && props.showVariantPicker !== false && selectedCode && (
        <button
          type="button"
          onClick={() => setShowDialect(true)}
          className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
        >
          <div>
            <p className="text-xs text-gray-400 mb-0.5">방언 / 변형 선택 (선택사항)</p>
            <p className="text-sm font-medium text-gray-700">
              {selectedVariant ? (ALL_LANG_LABELS[selectedVariant] ?? selectedVariant) : '표준어 (지역 무관)'}
            </p>
          </div>
          <span className="text-gray-400 text-sm ml-2">›</span>
        </button>
      )}

      {showOther && (
        <OtherLanguagesSheet
          onSelect={handleOtherSelect}
          onClose={() => setShowOther(false)}
        />
      )}

      {showDialect && !isMulti(props) && selectedCode && (
        <DialectSheet
          languageCode={selectedCode}
          selectedVariant={selectedVariant}
          onSelect={(v) => {
            if (props.onVariantChange) props.onVariantChange(v)
            setShowDialect(false)
          }}
          onClose={() => setShowDialect(false)}
        />
      )}
    </div>
  )
}
