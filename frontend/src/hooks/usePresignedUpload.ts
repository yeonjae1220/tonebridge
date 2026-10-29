import { useState } from 'react'
import { api } from '@/lib/api'
import { uploadRecording, captureAccountGuard } from '@/lib/validationDiagnostics'

interface PresignedUploadResult {
  uploadUrl: string
  audioKey: string
}

export function usePresignedUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File): Promise<string> => {
    const requireSameAccount = captureAccountGuard()
    setUploading(true)
    setError(null)
    try {
      const { data } = await api.post<PresignedUploadResult>('/storage/presigned-upload', {
        fileName: file.name,
        contentType: file.type,
      })

      requireSameAccount()
      await uploadRecording(data.uploadUrl, file)

      requireSameAccount()
      return data.audioKey
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setError(msg)
      throw e
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error }
}
