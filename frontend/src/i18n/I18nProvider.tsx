'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { DEFAULT_UI_LANGUAGE, MessageKey, messages, normalizeUiLanguage, UI_LANGUAGE_KEY, UiLanguage } from './messages'

type I18nContextValue = {
  language: UiLanguage
  setLanguage: (language: string) => void
  t: (key: MessageKey) => string
}

function readLangCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${UI_LANGUAGE_KEY}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

function writeLangCookie(lang: string): void {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${UI_LANGUAGE_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax${secure}`
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  initialLanguage = DEFAULT_UI_LANGUAGE,
}: {
  children: React.ReactNode
  initialLanguage?: UiLanguage
}) {
  const { data: currentUser } = useCurrentUser()
  // 서버가 쿠키로 결정한 언어를 초기값으로 사용 → SSR/hydration 첫 렌더 일치.
  const [language, setLanguageState] = useState<UiLanguage>(initialLanguage)

  // 로그인 사용자의 저장된 uiLanguage가 있으면 그걸, 없으면 쿠키 > localStorage > 브라우저 순.
  // (useEffect는 클라이언트에서만 실행되므로 window/document는 항상 존재)
  useEffect(() => {
    const stored = readLangCookie() ?? window.localStorage.getItem(UI_LANGUAGE_KEY)
    const resolved = normalizeUiLanguage(
      currentUser?.uiLanguage ?? stored ?? navigator.language.slice(0, 2),
    )
    setLanguageState(resolved)
    // 쿠키 백필: 쿠키가 없던 기존 사용자(localStorage만 보유)와 로그인 사용자도
    // 다음 로드부터 서버가 쿠키로 SSR <html lang>을 정확히 결정하도록 한다.
    window.localStorage.setItem(UI_LANGUAGE_KEY, resolved)
    writeLangCookie(resolved)
  }, [currentUser?.uiLanguage])

  // 접근성: <html lang>을 현재 UI 언어와 동기화 (스크린리더 발음 엔진 정합)
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage: (next) => {
      const normalized = normalizeUiLanguage(next)
      setLanguageState(normalized)
      window.localStorage.setItem(UI_LANGUAGE_KEY, normalized)
      writeLangCookie(normalized)
    },
    t: (key) => messages[language][key] ?? messages[DEFAULT_UI_LANGUAGE][key] ?? key,
  }), [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used within I18nProvider')
  return value
}
