import { useCallback, useEffect, useRef, useState } from 'react'

function themeColor(variable: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value ? `rgb(${value})` : fallback
}

function waveSurferThemeColors() {
  return {
    waveColor: themeColor('--color-indigo-500', 'rgb(99 102 241)'),
    progressColor: themeColor('--color-indigo-600', 'rgb(165 180 252)'),
    cursorColor: themeColor('--color-blue-100', 'rgb(219 234 254)'),
  }
}

export function useWaveSurfer(containerRef: React.RefObject<HTMLElement | null>, audioUrl: string | null) {
  const wavesurferRef = useRef<import('wavesurfer.js').default | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)

  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(n => n + 1), [])

  useEffect(() => {
    setReady(false); setPlaying(false); setDuration(0); setCurrentTime(0); setFailed(false)
    if (!containerRef.current || !audioUrl) return

    let cancelled = false
    let ws: import('wavesurfer.js').default | undefined
    const controller = new AbortController()
    let failureReported = false
    const fail = () => {
      if (cancelled || failureReported) return
      failureReported = true
      setFailed(true); setReady(false); setPlaying(false)
      console.warn('[audio] Playback unavailable')
    }
    const timer = setTimeout(() => { fail(); controller.abort() }, 30_000)

    const init = async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default
      if (cancelled) return

      ws = WaveSurfer.create({
        container: containerRef.current!,
        ...waveSurferThemeColors(),
        height: 64,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        dragToSeek: true,
        fetchParams: { signal: controller.signal },
      })

      ws.on('ready', () => {
        if (cancelled || failureReported) return
        clearTimeout(timer)
        setDuration(ws!.getDuration())
        setReady(true)
      })
      ws.on('timeupdate', (t) => setCurrentTime(t))
      ws.on('play', () => setPlaying(true))
      ws.on('pause', () => setPlaying(false))
      ws.on('finish', () => setPlaying(false))

      ws.on('error', fail)
      wavesurferRef.current = ws

      const themeObserver = new MutationObserver(() => {
        ws?.setOptions(waveSurferThemeColors())
      })
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })

      ws.on('destroy', () => themeObserver.disconnect())
      await ws.load(audioUrl)
    }

    // load rejects on HTTP/decode failures and destroy-time cancellation. Always consume it.
    void init().catch(fail).finally(() => clearTimeout(timer))

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
      ws?.destroy()
      wavesurferRef.current = null
      setReady(false)
      setPlaying(false)
      setCurrentTime(0)
    }
  }, [audioUrl, containerRef, attempt])

  const togglePlay = () => {
    const ws = wavesurferRef.current
    void ws?.playPause().catch(() => {
      if (wavesurferRef.current === ws) { setFailed(true); setReady(false); setPlaying(false) }
    })
  }
  const seekTo = (seconds: number) => {
    const ws = wavesurferRef.current
    if (ws && duration > 0) ws.seekTo(Math.max(0, Math.min(1, seconds / duration)))
  }

  return { playing, currentTime, duration, ready, failed, retry, togglePlay, seekTo }
}
