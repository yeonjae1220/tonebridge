import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { reportDiagnostic } from '@/lib/validationDiagnostics'
import { recordingDrafts } from '@/lib/recordingDrafts'
import { finalizeRecording } from '@/lib/audioDuration'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { DraftStatus } from '@/lib/recordingDrafts'

type RecorderState = 'idle' | 'recording' | 'processing' | 'stopped'
const AUDIO_FORMATS = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']

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

export function useAudioRecorder(scope = '') {
  const sessionGeneration = useAuthStore((s) => s.sessionGeneration)
  const { data: currentUser } = useCurrentUser()
  const owner = currentUser?.id
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('loading')
  const [restored, setRestored] = useState(false)
  const [interrupted, setInterrupted] = useState(false)
  const [state, setState] = useState<RecorderState>('idle')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<RecorderError | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const urlRef = useRef<string | null>(null)
  const startingRef = useRef(false)
  const generation = useRef(0)
  const discardedRuns = useRef(new Set<number>())
  const draftKey = `${sessionGeneration}:${scope}`
  const startedAt = useRef(0)

  const release = useCallback((preserve = false) => {
    if (!preserve) discardedRuns.current.add(generation.current)
    generation.current++
    startingRef.current = false
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      if (!preserve) { recorder.onstop = null; recorder.ondataavailable = null }
      recorder.onerror = null
      if (recorder.state !== 'inactive') recorder.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }, [])

  const reset = useCallback(() => {
    release()
    recordingDrafts.delete(draftKey)
    setAudioBlob(null)
    setAudioUrl(null)
    setDuration(0)
    setError(null)
    setStarting(false)
    setState('idle')
  }, [release, draftKey])

  useEffect(() => {
    setState('idle'); setStarting(false); setError(null); setAudioBlob(null); setAudioUrl(null); setDuration(0)
    let previousBlob: Blob | null = null
    const restore = () => {
      const info = recordingDrafts.info(draftKey)
      setDraftStatus(info?.status ?? 'loading')
      setRestored(info?.restored ?? false)
      setInterrupted(info?.draft?.interrupted ?? false)
      if (recordingDrafts.isActive(draftKey)) return
      const draft = recordingDrafts.get(draftKey)
      if (!draft) {
        if (previousBlob) {
          previousBlob = null
          if (urlRef.current) URL.revokeObjectURL(urlRef.current)
          urlRef.current = null
          setAudioBlob(null); setAudioUrl(null); setDuration(0); setState('idle')
        }
        return
      }
      if (draft.blob === previousBlob) return
      previousBlob = draft.blob
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(draft.blob)
      setAudioBlob(draft.blob); setAudioUrl(urlRef.current); setDuration(draft.duration); setState('stopped')
    }
    restore()
    const unsubscribe = recordingDrafts.subscribe(restore)
    if (owner) void recordingDrafts.load(draftKey, owner, scope)
    return () => { unsubscribe(); release(true) }
  }, [draftKey, release, owner, scope])

  const start = useCallback(async () => {
    if (startingRef.current || recorderRef.current?.state === 'recording' || !owner || draftStatus === 'loading') return
    reset()
    const run = generation.current
    startingRef.current = true
    setStarting(true)
    reportDiagnostic('RECORDING_ATTEMPT')
    let stream: MediaStream | null = null
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('Unavailable', window.isSecureContext ? 'NotSupportedError' : 'SecurityError')
      }
      const mimeType = typeof MediaRecorder === 'undefined' ? undefined
        : AUDIO_FORMATS.find((type) => MediaRecorder.isTypeSupported(type))
      if (!mimeType) throw new DOMException('Unsupported format', 'NotSupportedError')
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Permission may resolve after navigation, logout, or an account switch.
      if (run !== generation.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      const recordingStarted = performance.now()
      recorderRef.current = recorder
      const chunks: BlobPart[] = []
      let lastCheckpoint = recordingStarted
      recorder.ondataavailable = (event) => {
        if (discardedRuns.current.has(run) || sessionGeneration !== useAuthStore.getState().sessionGeneration || !event.data.size) return
        chunks.push(event.data)
        // Persist while recording, not in beforeunload (transactions may be aborted there).
        if (performance.now() - lastCheckpoint >= 1000 && recorder.state === 'recording') {
          lastCheckpoint = performance.now()
          recordingDrafts.set(draftKey, { blob: new Blob(chunks, { type: (recorder.mimeType || mimeType).split(';')[0] }),
            duration: (lastCheckpoint - recordingStarted) / 1000, interrupted: true }, true)
        }
      }
      recorder.onerror = () => {
        if (run !== generation.current) return
        release()
        recordingDrafts.delete(draftKey)
        setState('idle')
        setError('unknown')
        reportDiagnostic('RECORDING_FAILED')
      }
      recorder.onstop = async () => {
        if (discardedRuns.current.has(run) || sessionGeneration !== useAuthStore.getState().sessionGeneration) return
        stream?.getTracks().forEach((track) => track.stop())
        if (run === generation.current) {
          streamRef.current = null
          recorderRef.current = null
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
        }
        // Keep the container type consistent with the upload signature and extension.
        const contentType = (recorder.mimeType || mimeType).split(';')[0].trim()
        const blob = new Blob(chunks, { type: contentType })
        if (!blob.size) {
          recordingDrafts.delete(draftKey)
          if (run === generation.current) { setState('idle'); setError('unknown') }
          reportDiagnostic('RECORDING_FAILED')
          return
        }
        if (run === generation.current) setState('processing')
        const draft = await finalizeRecording(blob, (performance.now() - recordingStarted) / 1000)
        if (discardedRuns.current.has(run) || sessionGeneration !== useAuthStore.getState().sessionGeneration) return
        recordingDrafts.set(draftKey, draft)
        reportDiagnostic('RECORDING_SUCCEEDED')
      }
      recorder.start(100)
      startedAt.current = performance.now()
      recordingDrafts.markActive(draftKey)
      setState('recording')
      timerRef.current = setInterval(() => setDuration(Math.floor((performance.now() - startedAt.current) / 1000)), 250)
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop())
      if (run !== generation.current) return
      release()
      setState('idle')
      setStarting(false)
      const failure = classifyRecorderError(cause)
      setError(failure)
      reportDiagnostic(failure === 'permissionDenied' ? 'MICROPHONE_DENIED' : 'RECORDING_FAILED')
    } finally {
      if (run === generation.current) {
        startingRef.current = false
        setStarting(false)
      }
    }
  }, [release, reset, draftKey, sessionGeneration, owner, draftStatus])

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const getFile = useCallback((fileName = 'recording'): File | null => {
    if (!audioBlob) return null
    const extension = audioBlob.type === 'audio/mp4' ? 'm4a' : audioBlob.type === 'audio/ogg' ? 'ogg' : 'webm'
    const stem = fileName.replace(/\.[^.]+$/, '')
    return new File([audioBlob], `${stem}.${extension}`, { type: audioBlob.type })
  }, [audioBlob])

  const clearSaved = useCallback((savedBlob: Blob | null) => {
    // A save may finish after navigation and a newer recording in the same scope.
    if (savedBlob && recordingDrafts.get(draftKey)?.blob === savedBlob) reset()
  }, [draftKey, reset])

  const retryDraft = useCallback(() => { void recordingDrafts.retry(draftKey) }, [draftKey])
  return { state, starting, error, audioBlob, audioUrl, duration, start, stop, reset, clearSaved, getFile,
    draftStatus, restored, interrupted, retryDraft }
}
