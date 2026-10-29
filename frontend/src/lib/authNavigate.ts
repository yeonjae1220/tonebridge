import { api } from './api'

/** Restrict post-auth navigation to local paths, including after URL decoding. */
export function isSafeRedirect(path: string): boolean {
  try {
    const decoded = decodeURIComponent(path)
    return decoded.startsWith('/') && !decoded.startsWith('//') && !/[\\\u0000-\u0020]/.test(decoded)
  } catch {
    return false
  }
}

export function consumePostAuthRedirect(): string {
  const explicit = sessionStorage.getItem('auth_redirect')
  sessionStorage.removeItem('auth_redirect')
  return explicit && isSafeRedirect(explicit) ? explicit : '/study'
}

/** Keep the invitation until required profile setup is complete. */
export async function resolvePostAuthPath(): Promise<string> {
  try {
    const { data } = await api.get<{ onboardingCompleted: boolean }>('/users/me')
    if (!data.onboardingCompleted) return '/onboarding'
    return consumePostAuthRedirect()
  } catch (error) {
    console.error('[auth] Could not load onboarding status', error)
    return '/onboarding'
  }
}
