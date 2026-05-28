'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/i18n/I18nProvider'

function LoginInner() {
  const searchParams = useSearchParams()
  const { t } = useI18n()

  const handleGoogleLogin = () => {
    const redirect = searchParams.get('redirect')
    // /로 시작하고 //가 아닌 경우만 허용 — open redirect 방지
    const isSafeRedirect = (path: string) => /^\/(?!\/)/.test(path)
    if (redirect && isSafeRedirect(redirect)) {
      sessionStorage.setItem('auth_redirect', redirect)
    }
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/auth/google`
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">ToneBridge</h1>
          <p className="mt-2 text-sm text-gray-500">{t('login.subtitle')}</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-gray-700"
        >
          <GoogleIcon />
          {t('login.google')}
        </button>

        <p className="text-center text-xs text-gray-400">
          {t('login.bonus')}
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm flex flex-col gap-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">ToneBridge</h1>
          </div>
        </div>
      </main>
    }>
      <LoginInner />
    </Suspense>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
