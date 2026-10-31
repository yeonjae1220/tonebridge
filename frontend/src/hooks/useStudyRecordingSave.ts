import { useState } from 'react'
import { api } from '@/lib/api'
import { captureAccountGuard, uploadRecording } from '@/lib/validationDiagnostics'
import { recordingRequest } from '@/lib/recordingRequest'
import { useAuthStore } from '@/stores/authStore'

type Upload = { audioKey: string; uploadUrl: string; createdAt: number; uploaded: boolean }
// The blob is retained with the draft; re-entry and timeout retries reuse its uploaded key.
let checkpoints = new WeakMap<Blob, Map<string, Upload>>()
useAuthStore.subscribe((current, previous) => {
  if (current.sessionGeneration !== previous.sessionGeneration) checkpoints = new WeakMap()
})

export function useStudyRecordingSave(cardId: string, purpose: 'practice' | 'example') {
  const [stage, setStage] = useState<'preparing' | 'uploading' | 'saving'>('preparing')
  const save = async (blob: Blob) => {
    const generation = useAuthStore.getState().sessionGeneration
    const requireSameAccount = captureAccountGuard()
    const key = `${generation}:${cardId}:${purpose}`
    let entries = checkpoints.get(blob)
    if (!entries) { entries = new Map(); checkpoints.set(blob, entries) }
    let checkpoint = entries.get(key)
    const extension = blob.type === 'audio/mp4' ? 'm4a' : blob.type === 'audio/ogg' ? 'ogg' : 'webm'
    const file = new File([blob], `recording.${extension}`, { type: blob.type })
    // A lost PUT response is safe to repeat. Never replace a key after confirm was attempted.
    if (!checkpoint || (!checkpoint.uploaded && Date.now() - checkpoint.createdAt > 10 * 60_000)) {
      setStage('preparing')
      const { data } = await recordingRequest((signal) => api.post<{ audioKey: string; uploadUrl: string }>(
        purpose === 'practice' ? '/storage/presigned-upload' : `/cards/${cardId}/native-audios/upload-url`,
        { fileName: file.name, ...(purpose === 'practice' ? { contentType: file.type } : {}) }, { signal },
      ))
      requireSameAccount()
      checkpoint = { ...data, createdAt: Date.now(), uploaded: false }
      entries.set(key, checkpoint)
    }
    if (!checkpoint.uploaded) {
      setStage('uploading')
      await uploadRecording(checkpoint.uploadUrl, file)
      requireSameAccount()
      checkpoint.uploaded = true
    }
    setStage('saving')
    requireSameAccount()
    const response = await recordingRequest((signal) => api.post(
      `/cards/${cardId}/${purpose === 'practice' ? 'attempts' : 'native-audios'}`,
      { audioKey: checkpoint!.audioKey }, { signal },
    ))
    requireSameAccount()
    return response
  }
  return { save, stage }
}
