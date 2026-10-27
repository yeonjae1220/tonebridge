import axios from 'axios'

/**
 * API 오류에서 사용자에게 보여줄 문구를 꺼낸다. 서버가 준 message 가 문자열이면 그것, 아니면 fallback.
 * `(e as AxiosError<...>).response.data.message` 처럼 모양을 단언하면 네트워크 오류·비-axios 예외에서
 * undefined 가 되거나 엉뚱한 값이 나온다 — 좁혀서 읽는다.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message: unknown }).message
      if (typeof message === 'string' && message.trim()) return message
    }
  }
  return fallback
}

/** 응답이 있으면 HTTP 상태코드, 네트워크 실패·비-axios 예외면 undefined. */
export function getApiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
