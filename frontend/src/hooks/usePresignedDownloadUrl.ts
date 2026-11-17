import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { withRequestDeadline } from '@/lib/requestDeadline'
import { getApiErrorStatus } from '@/lib/apiError'

/**
 * 오디오 키 → 다운로드용 presigned URL.
 * 실패를 url=null 로만 두면 '로딩 중'과 구분되지 않아 재생 버튼이 이유 없이 영원히 비활성이 된다 —
 * 실패는 별도 boolean 으로 노출하고 재시도 수단을 준다(GLOBAL-PIT-108, NativeAudioPlayer 와 같은 방식).
 */
export function usePresignedDownloadUrl(audioKey: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setUrl(null)
    setFailed(false)
    if (!audioKey) return
    let alive = true
    const controller = new AbortController()
    withRequestDeadline(signal => api.get<{ downloadUrl: string }>('/storage/presigned-download', {
      params: { key: audioKey }, signal,
    }), 15_000, controller.signal)
      .then((r) => {
        if (alive) setUrl(r.data.downloadUrl)
      })
      .catch((e: unknown) => {
        if (!alive) return
        console.error('[audio] Download URL lookup failed', { status: getApiErrorStatus(e) ?? null })
        setFailed(true)
      })
    return () => {
      alive = false
      controller.abort()
    }
  }, [audioKey, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { url, failed, retry }
}
