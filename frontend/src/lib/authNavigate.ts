import { api } from './api'

/** /로 시작하고 //가 아닌 경우만 허용 — open redirect 방지 */
export const isSafeRedirect = (path: string) => /^\/(?!\/)/.test(path)

/**
 * 로그인/회원가입 성공 직후 이동할 경로를 결정한다.
 * 1) sessionStorage의 auth_redirect(있고 안전하면) 우선
 * 2) 아니면 온보딩 완료 여부로 /study 또는 /onboarding 분기
 * accessToken은 호출 전에 이미 저장되어 있어야 한다(api 인터셉터가 Authorization 헤더 부착).
 */
export async function resolvePostAuthPath(): Promise<string> {
  const explicit = sessionStorage.getItem('auth_redirect')
  sessionStorage.removeItem('auth_redirect')
  if (explicit && isSafeRedirect(explicit)) return explicit

  try {
    const { data } = await api.get<{ onboardingCompleted: boolean }>('/users/me')
    return data.onboardingCompleted ? '/study' : '/onboarding'
  } catch {
    return '/onboarding'
  }
}
