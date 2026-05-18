'use client'

import { useState } from 'react'
import { OTHER_LANGUAGES, type Language } from '@/constants/languages'

interface OtherLanguagesSheetProps {
  onSelect: (lang: Language) => void
  onClose: () => void
}

export function OtherLanguagesSheet({ onSelect, onClose }: OtherLanguagesSheetProps) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? OTHER_LANGUAGES.filter((l) => l.label.includes(query.trim()))
    : OTHER_LANGUAGES

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-bold text-gray-900">기타 언어 선택</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="px-5 pb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="언어 검색..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
        </div>

        <div className="overflow-y-auto px-5 pb-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">검색 결과가 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => onSelect(lang)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                >
                  {lang.flag && <span className="text-xl">{lang.flag}</span>}
                  <span className="text-sm font-medium text-gray-800">{lang.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
