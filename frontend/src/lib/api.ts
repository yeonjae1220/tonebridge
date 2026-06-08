import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'

// _retry 필드를 Axios 타입에 병합 — AxiosRequestConfig에 없는 필드를 안전하게 사용
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // refresh_token httpOnly 쿠키를 모든 요청에 포함
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 동시 401 응답에서 refresh를 한 번만 호출하기 위한 플래그
let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else if (token !== null) {
      resolve(token)
    } else {
      reject(new Error('Token was null after successful refresh'))
    }
  })
  pendingQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original: InternalAxiosRequestConfig & { _retry?: boolean } = error.config

    // _retry が true なら refresh 自体の失敗か retry済み → 로그아웃
    if (error.response?.status === 401 && original?._retry) {
      useAuthStore.getState().logout()
      if (typeof window !== 'undefined') window.location.href = '/login'
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      if (isRefreshing) {
        // 이미 refresh 중이면 큐에 대기
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      isRefreshing = true
      try {
        // _retry: true 를 명시해서 이 요청 자체가 401이 되면 위의 guard가 잡음
        const { data } = await axios.post<{ accessToken: string }>(
          '/api/auth/refresh',
          null,
          { withCredentials: true, _retry: true } as InternalAxiosRequestConfig
        )
        const newToken = data.accessToken
        useAuthStore.getState().setAccessToken(newToken)
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        processQueue(refreshError, null)
        useAuthStore.getState().logout()
        if (typeof window !== 'undefined') window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

/**
 * 이메일/비밀번호 로그인. 성공 시 accessToken을 메모리에 저장하고 refresh 쿠키가 설정됩니다.
 * `api` 인스턴스 대신 bare axios를 사용 — 401 응답이 refresh 인터셉터 루프를 타지 않도록 함.
 */
export async function loginWithPassword(email: string, password: string): Promise<void> {
  const { data } = await axios.post<{ accessToken: string }>(
    '/api/auth/login',
    { email, password },
    { withCredentials: true }
  )
  useAuthStore.getState().setAccessToken(data.accessToken)
}

/**
 * 이메일/비밀번호 회원가입. 성공 시 즉시 로그인 처리되어 accessToken이 저장됩니다.
 */
export async function registerWithPassword(
  email: string,
  username: string,
  password: string
): Promise<void> {
  const { data } = await axios.post<{ accessToken: string }>(
    '/api/auth/register',
    { email, username, password },
    { withCredentials: true }
  )
  useAuthStore.getState().setAccessToken(data.accessToken)
}

/** 페이지 최초 로드 시 accessToken이 없으면 쿠키로 조용히 복원을 시도합니다. */
export async function tryRestoreSession(): Promise<boolean> {
  if (useAuthStore.getState().accessToken) return true
  try {
    const { data } = await axios.post<{ accessToken: string }>(
      '/api/auth/refresh',
      null,
      { withCredentials: true }
    )
    useAuthStore.getState().setAccessToken(data.accessToken)
    return true
  } catch {
    return false
  }
}

/** 로그아웃: 백엔드 쿠키 삭제 후 로컬 상태 초기화 */
export async function logout(): Promise<void> {
  try {
    await axios.post('/api/auth/logout', null, { withCredentials: true })
  } catch {
    // 쿠키 삭제 실패해도 로컬 상태는 지움
  }
  useAuthStore.getState().logout()
}
