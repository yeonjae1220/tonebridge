import { fixWebmDuration } from '@fix-webm-duration/fix'

// Measure audio samples rather than interval ticks (which mobile browsers throttle).
export async function decodedDuration(blob: Blob): Promise<number> {
  const decoder = new OfflineAudioContext(1, 1, 48000)
  const audio = await decoder.decodeAudioData(await blob.arrayBuffer())
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) throw new Error('Invalid audio duration')
  return audio.duration
}

export async function finalizeRecording(blob: Blob, elapsedSeconds: number) {
  let duration = elapsedSeconds
  try { duration = await decodedDuration(blob) } catch { /* Keep the recording if decoding is unavailable. */ }
  if (blob.type === 'audio/webm' && duration > 0) {
    try { blob = await fixWebmDuration(blob, duration * 1000, { logger: false }) } catch { /* Never discard captured audio. */ }
  }
  return { blob, duration }
}
