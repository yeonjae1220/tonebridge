import { cloudBindings, saveCloudBindings, finishCloudSubmission } from '@/lib/cloudDraftLocal'
import { prepareCloudSubmission } from '@/lib/cloudDraftSync'
import { uploadCloudRecording } from '@/lib/cloudAudioSync'
import { getApiErrorStatus } from '@/lib/apiError'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { useState } from 'react'
import { api } from '@/lib/api'
import { captureAccountGuard, uploadRecording } from '@/lib/validationDiagnostics'
import { recordingRequest } from '@/lib/recordingRequest'
import { useAuthStore } from '@/stores/authStore'
import { recordingDrafts } from '@/lib/recordingDrafts'

type Upload = { audioKey: string; uploadUrl: string; createdAt: number; uploaded: boolean }
// The blob is retained with the draft; re-entry and timeout retries reuse its uploaded key.
let checkpoints = new WeakMap<Blob, Map<string, Upload>>()
useAuthStore.subscribe((current, previous) => {
  if (current.sessionGeneration !== previous.sessionGeneration) checkpoints = new WeakMap()
})

export function useStudyRecordingSave(cardId: string, purpose: 'practice' | 'example') {
  const { suggestInstall } = usePWAInstall()
  const [stage, setStage] = useState<'preparing' | 'uploading' | 'saving'>('preparing')
  const save = async (blob: Blob) => {
    const generation = useAuthStore.getState().sessionGeneration
    const requireSameAccount = captureAccountGuard()
    const scope = `audio:${purpose}:${cardId}`
    const owner = recordingDrafts.ownerOf(blob)
    let operation: string | undefined
    if (owner) {
      const rows = cloudBindings(owner), row = rows[scope]
      if (row) {
        if (row.audio?.sourceId !== recordingDrafts.idOf(blob)) {
          if (row.pendingLocal || row.submissionOperation) { rows[scope] = { ...row, error: 'conflict' }; saveCloudBindings(owner, rows) }
          throw new Error('Resolve the previous recording submission before saving this recording')
        }
        operation = row.submissionOperation ?? crypto.randomUUID()
        rows[scope] = { ...row, submissionOperation: operation }; saveCloudBindings(owner, rows)
        try {
          const receipt = await recordingRequest(signal => api.get<{ type: string }>('/submissions/' + operation, { signal }))
          requireSameAccount()
          if (receipt.data.type !== purpose) throw new Error('Submission is no longer available')
          finishCloudSubmission(owner, scope, operation); return receipt
        } catch (e) { if (getApiErrorStatus(e) !== 404) throw e }
        await uploadCloudRecording(owner, scope); requireSameAccount()
      }
    }
    const key = `${generation}:${cardId}:${purpose}`
    let entries = checkpoints.get(blob)
    if (!entries) { entries = new Map(); checkpoints.set(blob, entries) }
    let checkpoint = entries.get(key)
    const recovered = recordingDrafts.getUpload(blob)
    if (!checkpoint && recovered) { checkpoint = { ...recovered, uploadUrl: '' }; entries.set(key, checkpoint) }
    const extension = blob.type === 'audio/mp4' ? 'm4a' : blob.type === 'audio/ogg' ? 'ogg' : blob.type === 'audio/wav' ? 'wav' : 'webm'
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
    await recordingDrafts.saveUpload(blob, { audioKey: checkpoint.audioKey, createdAt: checkpoint.createdAt, uploaded: true })
    requireSameAccount()
    setStage('saving')
    requireSameAccount()
    if (owner && operation) {
      const receipt = await prepareCloudSubmission(owner, scope, operation, 'SUBMISSION', { audioKey: checkpoint.audioKey, cardId, purpose }, undefined, true)
      requireSameAccount()
      if (receipt) { finishCloudSubmission(owner, scope, operation); return { data: receipt } }
    }
    const response = await recordingRequest((signal) => api.post(
      `/cards/${cardId}/${purpose === 'practice' ? 'attempts' : 'native-audios'}`,
      { audioKey: checkpoint!.audioKey }, { signal, headers: operation ? { 'Idempotency-Key': operation } : undefined },
    ))
    requireSameAccount()
    if (owner && operation) finishCloudSubmission(owner, scope, operation)
    suggestInstall()
    return response
  }
  return { save, stage }
}
