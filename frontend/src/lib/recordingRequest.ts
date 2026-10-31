export const RECORDING_TIMEOUT_MS = 30_000
export class RecordingTimeoutError extends Error {
  constructor() { super('RECORDING_TIMEOUT'); this.name = 'RecordingTimeoutError' }
}

export async function recordingRequest<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('RECORDING_OFFLINE')
  const controller = new AbortController()
  let expired = false
  const timer = setTimeout(() => { expired = true; controller.abort() }, RECORDING_TIMEOUT_MS)
  try { return await request(controller.signal) }
  catch (error) { if (expired) throw new RecordingTimeoutError(); throw error }
  finally { clearTimeout(timer) }
}
