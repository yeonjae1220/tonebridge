import { useCallback, useEffect, useRef, useState } from 'react'

type RecorderState = 'idle' | 'recording' | 'stopped'

const MIME_TYPE = 'audio/webm;codecs=opus'

/**
 * 녹음 시작 실패 원인. 화면에 사용자가 할 수 있는 조치를 안내하려고 나눈다 —
 * 실패를 삼키면 버튼이 무반응으로만 보인다(GLOBAL-PIT-108·190).
 */
export type RecorderError = 'permissionDenied' | 'blocked' | 'noDevice' | 'busy' | 'unsupported' | 'unknown'

function microphoneBlockedByPolicy(): boolean {
  const doc = document as Document & {
    featurePolicy?: { allowsFeature: (feature: string) => boolean }
  }
  return doc.featurePolicy?.allowsFeature('microphone') === false
}

export function classifyRecorderError(e: unknown): RecorderError {
  const name = e instanceof DOMException || e instanceof Error ? e.name : ''
  switch (name) {
    case 'NotAllowedError':
      // Permissions-Policy 가 막으면 권한 창 없이 같은 NotAllowedError 가 난다.
      return microphoneBlockedByPolicy() ? 'blocked' : 'permissionDenied'
    case 'SecurityError':
      return 'blocked'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'noDevice'
    case 'NotReadableError':
    case 'AbortError':
      return 'busy'
    case 'NotSupportedError':
      return 'unsupported'
    default:
      return 'unknown'
  }
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<RecorderError | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 권한 창이 떠 있는 동안 state 는 아직 idle 이라 버튼을 다시 누를 수 있다 — 스트림이 중복으로 열리지 않게 막는다.
  const startingRef = useRef(false)

  const start = useCallback(async () => {
    if (startingRef.current) return
    startingRef.current = true
    setError(null)

    let stream: MediaStream | null = null
    try {
      // 비보안 출처나 미지원 브라우저에서는 mediaDevices·MediaRecorder 자체가 없다.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext ? 'unsupported' : 'blocked')
        return
      }
      if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(MIME_TYPE)) {
        setError('unsupported')
        return
      }

      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE })
      const activeStream = stream
      chunksRef.current = []
      setDuration(0)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: MIME_TYPE })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        activeStream.getTracks().forEach((t) => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)
      }

      recorder.start(100)
      mediaRecorderRef.current = recorder
      setState('recording')

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch (e) {
      console.error('[useAudioRecorder] 녹음 시작 실패', e)
      // getUserMedia 는 성공했는데 MediaRecorder 생성·시작이 실패하면 마이크가 켜진 채 남는다.
      stream?.getTracks().forEach((t) => t.stop())
      setError(classifyRecorderError(e))
    } finally {
      startingRef.current = false
    }
  }, [])

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setState('stopped')
  }, [])

  const reset = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setDuration(0)
    setError(null)
    setState('idle')
  }, [audioUrl])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const getFile = useCallback(
    (fileName = 'recording.webm'): File | null => {
      if (!audioBlob) return null
      return new File([audioBlob], fileName, { type: audioBlob.type })
    },
    [audioBlob]
  )

  return { state, error, audioBlob, audioUrl, duration, start, stop, reset, getFile }
}
