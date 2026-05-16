import { useCallback, useRef, useState } from 'react'

type RecorderState = 'idle' | 'recording' | 'stopped'

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    chunksRef.current = []
    setDuration(0)

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' })
      setAudioBlob(blob)
      setAudioUrl(URL.createObjectURL(blob))
      stream.getTracks().forEach((t) => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }

    recorder.start(100)
    mediaRecorderRef.current = recorder
    setState('recording')

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
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
    setState('idle')
  }, [audioUrl])

  const getFile = useCallback(
    (fileName = 'recording.webm'): File | null => {
      if (!audioBlob) return null
      return new File([audioBlob], fileName, { type: audioBlob.type })
    },
    [audioBlob]
  )

  return { state, audioBlob, audioUrl, duration, start, stop, reset, getFile }
}
