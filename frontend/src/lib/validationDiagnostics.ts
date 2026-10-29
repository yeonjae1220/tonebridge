import { useAuthStore } from '@/stores/authStore'

export type Diagnostic = 'RECORDING_ATTEMPT' | 'RECORDING_SUCCEEDED' | 'RECORDING_FAILED'
  | 'MICROPHONE_DENIED' | 'UPLOAD_ATTEMPT' | 'UPLOAD_SUCCEEDED' | 'UPLOAD_FAILED'

// Best effort only: no payload content, URLs, account IDs, refresh, retries or storage.
export function reportDiagnostic(event: Diagnostic, generation = useAuthStore.getState().sessionGeneration) {
  const { accessToken: token, sessionGeneration } = useAuthStore.getState()
  if (!token || generation !== sessionGeneration) return
  void fetch('/api/validation/diagnostics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => { /* Diagnostics must never interrupt learning. */ })
}

export async function uploadRecording(url: string, file: File) {
  const generation = useAuthStore.getState().sessionGeneration
  reportDiagnostic('UPLOAD_ATTEMPT', generation)
  try {
    const response = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`)
    reportDiagnostic('UPLOAD_SUCCEEDED', generation)
  } catch (error) {
    reportDiagnostic('UPLOAD_FAILED', generation)
    throw error
  }
}

export function captureAccountGuard() {
  const generation = useAuthStore.getState().sessionGeneration
  return () => {
    const current = useAuthStore.getState()
    if (!current.accessToken || current.sessionGeneration !== generation) throw new Error('Account changed')
  }
}
