'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nProvider'
import { registerWithPassword } from '@/lib/api'
import { resolvePostAuthPath } from '@/lib/authNavigate'

export default function SignupPage() {
  const router = useRouter()
  const { t } = useI18n()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await registerWithPassword(email.trim(), username.trim(), password)
      const path = await resolvePostAuthPath()
      router.replace(path)
    } catch (err) {
      const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response
      // 409(이메일/닉네임 중복)는 서버가 제공하는 사유 메시지를 그대로 노출, 그 외는 일반 메시지
      const serverMessage = res?.status === 409 ? res?.data?.message : undefined
      setError(serverMessage ?? t('signup.error'))
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-surface rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('signup.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('signup.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-gray-700">{t('signup.email')}</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-gray-700">{t('signup.username')}</span>
            <input
              type="text"
              autoComplete="username"
              required
              minLength={2}
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition"
            />
            <span className="text-xs text-gray-400">{t('signup.usernameHint')}</span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-gray-700">{t('signup.password')}</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={100}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition"
            />
            <span className="text-xs text-gray-400">{t('signup.passwordHint')}</span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {t('signup.submit')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          {t('signup.haveAccount')}{' '}
          <Link href="/login" className="font-medium text-gray-900 underline-offset-2 hover:underline">
            {t('signup.loginLink')}
          </Link>
        </p>
      </div>
    </main>
  )
}
