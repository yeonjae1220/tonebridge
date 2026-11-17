import { bindRecoveryOwner } from '@/lib/recoveryDraft'
import { bindEditorOwner } from '@/lib/composeEditorDraft'
import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { recordingDrafts } from '@/lib/recordingDrafts'
import { withWriteDeadline } from '@/lib/writeDeadline'
import { withRequestDeadline } from '@/lib/requestDeadline'

// _retry 필드를 Axios 타입에 병합 — AxiosRequestConfig에 없는 필드를 안전하게 사용
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean
    _sessionGeneration?: number
  }
}

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // refresh_token httpOnly 쿠키를 모든 요청에 포함
})

function requireSession(generation: number | undefined) {
  if (generation !== useAuthStore.getState().sessionGeneration) {
    throw new axios.CanceledError('Account changed')
  }
}

api.interceptors.request.use((config) => {
  const { accessToken, sessionGeneration } = useAuthStore.getState()
  config._sessionGeneration ??= sessionGeneration
  requireSession(config._sessionGeneration)
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  else config.headers.delete('Authorization')
  return config
})

type RefreshFlight = { generation: number; controller: AbortController; promise: Promise<string> }
let refreshFlight: RefreshFlight | null = null
let logoutFlight: Promise<void> | null = null
let authenticationAttempt: AbortController | null = null
useAuthStore.subscribe((state, previous) => {
  if (state.sessionGeneration === previous.sessionGeneration) return
  refreshFlight?.controller.abort()
  refreshFlight = null
  authenticationAttempt?.abort()
  authenticationAttempt = null
})

// This non-secret marker denies silent restoration if remote logout fails. Explicit
// password login clears it here; the server clears it for successful OAuth as well.
function locallySignedOut(): boolean {
  return typeof document !== 'undefined' && document.cookie.split(';').some(cookie => cookie.trim() === 'tonebridge_signed_out=1')
}
function setLocalSignout(signedOut: boolean) {
  if (typeof document === 'undefined') return
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `tonebridge_signed_out=${signedOut ? '1' : ''}; Path=/; Max-Age=${signedOut ? 31536000 : 0}; SameSite=Lax${secure}`
}
function requireRestorableSession() {
  if (locallySignedOut()) throw new axios.CanceledError('Locally signed out')
}

function refreshAccessToken(generation: number): Promise<string> {
  requireRestorableSession()
  requireSession(generation)
  if (authenticationAttempt) throw new axios.CanceledError('Authentication in progress')
  if (refreshFlight?.generation === generation) return refreshFlight.promise
  const controller = new AbortController()
  const flight: RefreshFlight = { generation, controller, promise: Promise.resolve('') }
  flight.promise = withRequestDeadline(signal => axios.post<{ accessToken: string }>('/api/auth/refresh', null, {
    withCredentials: true, signal,
  }), 15_000, controller.signal).then(({ data }) => {
    requireRestorableSession()
    requireSession(generation)
    useAuthStore.getState().setAccessToken(data.accessToken)
    return data.accessToken
  }).finally(() => {
    // An older refresh must never clear a newer account's in-flight refresh.
    if (refreshFlight === flight) refreshFlight = null
  })
  refreshFlight = flight
  return flight.promise
}

function expireSession(generation: number | undefined) {
  requireSession(generation)
  useAuthStore.getState().logout()
  if (typeof window !== 'undefined') window.location.href = '/login'
}

api.interceptors.response.use(
  (res) => {
    requireSession(res.config._sessionGeneration)
    if (res.config.url === '/users/me' && typeof res.data?.id === 'string') { recordingDrafts.bindOwner(res.data.id); bindEditorOwner(res.data.id); bindRecoveryOwner(res.data.id) }
    return res
  },
  async (error) => {
    const original: InternalAxiosRequestConfig | undefined = error.config
    if (!original) return Promise.reject(error)
    requireSession(original._sessionGeneration)
    if (error.response?.status !== 401) return Promise.reject(error)
    if (original._retry) {
      expireSession(original._sessionGeneration)
      return Promise.reject(error)
    }
    original._retry = true
    try {
      await refreshAccessToken(original._sessionGeneration!)
    } catch (refreshError) {
      // Only a definitive credential rejection expires the session. A timeout,
      // network failure or 5xx must not revoke this account's retained drafts.
      if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401
        && original._sessionGeneration === useAuthStore.getState().sessionGeneration) {
        expireSession(original._sessionGeneration)
      }
      return Promise.reject(refreshError)
    }
    requireSession(original._sessionGeneration)
    return api(original)
  }
)

/** Password authentication owns its HTTP request, including Set-Cookie side effects. */
async function authenticate(path: string, payload: Record<string, string>, signal?: AbortSignal): Promise<void> {
  authenticationAttempt?.abort()
  refreshFlight?.controller.abort()
  refreshFlight = null
  const controller = new AbortController()
  authenticationAttempt = controller
  const generation = useAuthStore.getState().sessionGeneration
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  const requireCurrentAttempt = () => {
    requireSession(generation)
    if (controller.signal.aborted || authenticationAttempt !== controller) {
      throw new axios.CanceledError('Authentication cancelled')
    }
  }
  try {
    // Cookie deletion must finish before a new login/register response sets its cookie.
    await logoutFlight
    requireCurrentAttempt()
    const { data } = await withRequestDeadline(signal => axios.post<{ accessToken: string }>(path, payload, {
      withCredentials: true, signal,
    }), 30_000, controller.signal)
    requireCurrentAttempt()
    authenticationAttempt = null
    setLocalSignout(false)
    useAuthStore.getState().beginSession(data.accessToken)
  } finally {
    signal?.removeEventListener('abort', cancel)
    if (authenticationAttempt === controller) authenticationAttempt = null
  }
}

/** Bare axios keeps credential errors out of the general API refresh interceptor. */
export function loginWithPassword(email: string, password: string, signal?: AbortSignal): Promise<void> {
  return authenticate('/api/auth/login', { email, password }, signal)
}

export function registerWithPassword(
  email: string,
  username: string,
  password: string,
  signal?: AbortSignal,
): Promise<void> {
  return authenticate('/api/auth/register', { email, username, password }, signal)
}

/** 페이지 최초 로드 시 accessToken이 없으면 쿠키로 조용히 복원을 시도합니다. */
export async function tryRestoreSession(): Promise<boolean> {
  if (locallySignedOut() || logoutFlight || authenticationAttempt) return false
  if (useAuthStore.getState().accessToken) return true
  const generation = useAuthStore.getState().sessionGeneration
  try {
    await refreshAccessToken(generation)
    return true
  } catch {
    return false
  }
}

/** 로그아웃: 로컬 작업을 즉시 무효화한 뒤 백엔드 쿠키 삭제 */
export async function logout(): Promise<void> {
  setLocalSignout(true)
  useAuthStore.getState().logout()
  if (logoutFlight) return logoutFlight
  const flight = (async () => {
    try {
      await withWriteDeadline(signal => axios.post('/api/auth/logout', null, { withCredentials: true, signal }))
    } catch {
      // Local access has already been cleared, even if cookie deletion fails.
    }
    await clearOfflineCaches()
    await recordingDrafts.settled()
  })()
  logoutFlight = flight
  try {
    await flight
  } finally {
    if (logoutFlight === flight) logoutFlight = null
  }
}

/** 서비스워커 캐시 비우기 — 옛 SW(v1)가 캐싱해 둔 API 응답이 다음 사용자에게 남지 않게. */
async function clearOfflineCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('tonebridge-')).map((key) => caches.delete(key)))
  } catch (e) {
    console.error('[logout] 오프라인 캐시 삭제 실패', e)
  }
}
