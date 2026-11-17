import { api } from './api'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { withRequestDeadline } from './requestDeadline'

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

/** Keep the invitation until a confirmed profile read establishes the destination. */
export async function resolvePostAuthPath(signal?: AbortSignal): Promise<string> {
  const generation = useAuthStore.getState().sessionGeneration
  const { data } = await withRequestDeadline(signal => api.get<{ onboardingCompleted: boolean }>('/users/me', { signal }), 15_000, signal)
  if (signal?.aborted || generation !== useAuthStore.getState().sessionGeneration) throw new axios.CanceledError('Account changed')
  if (typeof data.onboardingCompleted !== 'boolean') throw new Error('Invalid onboarding status')
  if (!data.onboardingCompleted) return '/onboarding'
  return consumePostAuthRedirect()
}
