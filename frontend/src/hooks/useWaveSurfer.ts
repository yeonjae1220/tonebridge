import { useEffect, useRef, useState } from 'react'

export function useWaveSurfer(containerRef: React.RefObject<HTMLElement | null>, audioUrl: string | null) {
  const wavesurferRef = useRef<import('wavesurfer.js').default | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return

    let cancelled = false
    let ws: import('wavesurfer.js').default | undefined

    const init = async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default
      if (cancelled) return

      ws = WaveSurfer.create({
        container: containerRef.current!,
        waveColor: '#6366f1',
        progressColor: '#a5b4fc',
        cursorColor: '#e0e7ff',
        height: 64,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      })

      ws.on('ready', () => {
        setDuration(ws!.getDuration())
        setReady(true)
      })
      ws.on('timeupdate', (t) => setCurrentTime(t))
      ws.on('play', () => setPlaying(true))
      ws.on('pause', () => setPlaying(false))
      ws.on('finish', () => setPlaying(false))

      ws.load(audioUrl)
      wavesurferRef.current = ws
    }

    init()

    return () => {
      cancelled = true
      ws?.destroy()
      wavesurferRef.current = null
      setReady(false)
      setPlaying(false)
      setCurrentTime(0)
    }
  }, [audioUrl]) // containerRef intentionally excluded — stable ref

  const togglePlay = () => wavesurferRef.current?.playPause()
  const seekTo = (seconds: number) => {
    const ws = wavesurferRef.current
    if (ws && duration > 0) ws.seekTo(seconds / duration)
  }

  return { playing, currentTime, duration, ready, togglePlay, seekTo }
}
