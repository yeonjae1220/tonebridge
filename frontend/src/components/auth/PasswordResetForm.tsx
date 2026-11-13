'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { validatePassword } from '@/lib/authValidation'
import { useAuthStore } from '@/stores/authStore'
import type { MessageKey } from '@/i18n/messages'

export function PasswordResetForm({ mode }: { mode: 'request' | 'confirm' }) {
  const { t } = useI18n()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<MessageKey | null>(null)
  const [field, setField] = useState<'email' | 'password' | 'confirmation' | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const readToken = useRef(false)
  const tokenGeneration = useRef(0)
  const alive = useRef(true)
  const requestInFlight = useRef(false)
  const submission = useRef<AbortController | null>(null)
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    setAvailable(null)
    fetch('/api/auth/password-reset/status', { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
      .then(async response => { if (!response.ok) throw new Error('unavailable'); return response.json() })
      .then(data => { if (active) setAvailable(data.enabled === true) })
      .catch(() => { if (active) setAvailable(false) })
      .finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [availabilityAttempt])
  useEffect(() => {
    alive.current = true
    const consumeToken = () => {
      if (mode !== 'confirm' || (!window.location.hash && readToken.current)) return
      readToken.current = true
      tokenGeneration.current++
      submission.current?.abort()
      const raw = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
      setToken(/^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : '')
      setDone(false); setError(null); setField(null); setPassword(''); setConfirmation('')
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
    consumeToken()
    window.addEventListener('hashchange', consumeToken)
    return () => { alive.current = false; submission.current?.abort(); window.removeEventListener('hashchange', consumeToken) }
  }, [mode])

  function invalid(form: HTMLFormElement, name: 'email' | 'password' | 'confirmation', key: MessageKey) {
    setField(name); setError(key)
    form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus()
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestInFlight.current || !available) return
    const form = event.currentTarget
    setError(null); setField(null)
    if (mode === 'request' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { invalid(form, 'email', 'access.emailInvalid'); return }
    if (mode === 'confirm') {
      const issue = validatePassword(password)
      if (issue) { invalid(form, 'password', issue); return }
      if (password !== confirmation) { invalid(form, 'confirmation', 'reset.mismatch'); return }
      if (!token) { setError('reset.invalid'); return }
    }
    const generation = tokenGeneration.current
    requestInFlight.current = true; setPending(true)
    const controller = new AbortController()
    submission.current = controller
    const timer = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetch('/api/auth/password-reset' + (mode === 'confirm' ? '/confirm' : ''), {
        method: 'POST', signal: controller.signal, credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'request' ? { email: email.trim() } : { token, password }),
      })
      if (!alive.current || generation !== tokenGeneration.current) return
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        if (!alive.current || generation !== tokenGeneration.current) return
        setError(response.status === 429 ? 'common.retryLater' : body.code === 'AUTH_007' ? 'reset.invalid' : response.status === 503 ? 'reset.unavailable' : 'reset.failure')
        return
      }
      setDone(true); setPassword(''); setConfirmation(''); setToken(null)
      if (mode === 'confirm') {
        // Local state has no authority after a reset; clear the current browser's session cookie too.
        useAuthStore.getState().logout()
        void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      }
    } catch { if (alive.current && generation === tokenGeneration.current) setError(mode === 'confirm' ? 'reset.confirmUncertain' : 'reset.failure') }
    finally { clearTimeout(timer); submission.current = null; requestInFlight.current = false; if (alive.current) setPending(false) }
  }
  const missingToken = mode === 'confirm' && token === ''
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-5 py-10">
    <section className="space-y-5 rounded-2xl border border-gray-200 bg-surface p-6">
      <h1 className="text-2xl font-bold">{t(done ? mode === 'request' ? 'reset.sent' : 'reset.success' : 'reset.title')}</h1>
      {done ? <p role="status" className="text-sm leading-relaxed">{t(mode === 'request' ? 'reset.sentDetail' : 'reset.successDetail')}</p> : <>
        {missingToken ? <p role="alert">{t('reset.invalid')}</p> : available === null ? <p role="status">{t('common.loading')}</p> : !available ? <p role="alert">{t('reset.unavailable')}</p> :
          <form noValidate onSubmit={submit} className="space-y-4">
            {mode === 'request' ? <label className="flex flex-col gap-2 text-sm">{t('login.email')}
              <input aria-label={t('login.email')} name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} aria-invalid={field === 'email'} aria-describedby={field === 'email' ? 'reset-error' : undefined} className="rounded-xl border border-gray-200 px-3 py-3 text-gray-900" />
            </label> : <>
              <label className="flex flex-col gap-2 text-sm">{t('login.password')}
                <input aria-label={t('login.password')} name="password" type="password" autoComplete="new-password" maxLength={72} value={password} onChange={e => setPassword(e.target.value)} aria-invalid={field === 'password'} aria-describedby={field === 'password' ? 'reset-error' : 'password-hint'} className="rounded-xl border border-gray-200 px-3 py-3 text-gray-900" />
              </label>
              <p id="password-hint" className="text-xs text-gray-500">{t('access.passwordRule')}</p>
              <label className="flex flex-col gap-2 text-sm">{t('reset.confirmPassword')}
                <input aria-label={t('reset.confirmPassword')} name="confirmation" type="password" autoComplete="new-password" maxLength={72} value={confirmation} onChange={e => setConfirmation(e.target.value)} aria-invalid={field === 'confirmation'} aria-describedby={field === 'confirmation' ? 'reset-error' : undefined} className="rounded-xl border border-gray-200 px-3 py-3 text-gray-900" />
              </label>
              <p className="text-sm text-gray-500">{t('reset.notice')}</p>
            </>}
            <button type="submit" disabled={pending || (mode === 'confirm' && !token)} className="min-h-11 w-full rounded-xl bg-action-primary px-4 py-3 font-semibold text-white disabled:opacity-40">{t(pending ? 'common.loading' : mode === 'request' ? 'reset.request' : 'reset.submit')}</button>
          </form>}
        {error && <p id="reset-error" role="alert" className="text-sm text-red-500">{t(error)}</p>}
      </>}
      {mode === 'request' && done && <button type="button" onClick={() => setDone(false)} className="min-h-11 text-blue-600">{t('reset.again')}</button>}
      {available === false && <button type="button" onClick={() => setAvailabilityAttempt(n => n + 1)} className="min-h-11 text-blue-600">{t('common.retry')}</button>}
      {mode === 'request' && <p className="text-sm text-gray-500">{t('reset.google')}</p>}
      {mode === 'confirm' && !done && <Link className="block min-h-11 py-2 text-blue-600" href="/forgot-password">{t('reset.again')}</Link>}
      <Link className="block min-h-11 py-2 text-blue-600" href="/login">{t('login.submit')}</Link>
      <Link className="block min-h-11 py-2 text-sm text-blue-600" href="/help#account-access">{t('reset.help')}</Link>
    </section>
  </main>
}
