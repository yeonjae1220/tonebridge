'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

type ThemeContextValue = {
  preference: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setPreference: (preference: ThemePreference) => void
}

const STORAGE_KEY = 'tonebridge_theme'
const THEME_QUERY = '(prefers-color-scheme: dark)'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function normalizeThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia(THEME_QUERY).matches ? 'dark' : 'light'
}

function applyTheme(preference: ThemePreference, systemTheme: 'light' | 'dark' = getSystemTheme()): 'light' | 'dark' {
  const resolvedTheme = preference === 'system' ? systemTheme : preference
  const root = document.documentElement

  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.dataset.theme = resolvedTheme
  root.style.colorScheme = resolvedTheme

  return resolvedTheme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const preferenceRef = useRef<ThemePreference>('system')

  useEffect(() => {
    const storedPreference = normalizeThemePreference(window.localStorage.getItem(STORAGE_KEY))
    const media = window.matchMedia(THEME_QUERY)

    preferenceRef.current = storedPreference
    setPreferenceState(storedPreference)
    setResolvedTheme(applyTheme(storedPreference, media.matches ? 'dark' : 'light'))

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setResolvedTheme(applyTheme(preferenceRef.current, event.matches ? 'dark' : 'light'))
    }

    media.addEventListener('change', handleSystemThemeChange)
    return () => media.removeEventListener('change', handleSystemThemeChange)
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    resolvedTheme,
    setPreference: (nextPreference) => {
      preferenceRef.current = nextPreference
      setPreferenceState(nextPreference)
      window.localStorage.setItem(STORAGE_KEY, nextPreference)
      setResolvedTheme(applyTheme(nextPreference))
    },
  }), [preference, resolvedTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
