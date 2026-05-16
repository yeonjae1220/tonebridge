import { useState } from 'react'
import { api } from '@/lib/api'

interface PresignedUploadResult {
  uploadUrl: string
  audioKey: string
}

export function usePresignedUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File): Promise<string> => {
    setUploading(true)
    setError(null)
    try {
      const { data } = await api.post<PresignedUploadResult>('/storage/presigned-upload', {
        fileName: file.name,
        contentType: file.type,
      })

      await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      return data.audioKey
    } catch (e) {
      const msg = e instanceof Error ? e.message : '업로드 실패'
      setError(msg)
      throw e
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error }
}
