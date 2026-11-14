import axios from 'axios'

/** A missing response cannot establish whether the server committed a write. */
export class WriteOutcomeUnknownError extends Error {
  constructor() { super('Write outcome unknown'); this.name = 'WriteOutcomeUnknownError' }
}

/** Bound the entire operation, including an interceptor waiting for token refresh. Never retry a write here. */
export async function withWriteDeadline<T>(write: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new WriteOutcomeUnknownError())
    }, 30_000)
  })
  try {
    return await Promise.race([write(controller.signal), deadline])
  } catch (error) {
    if (controller.signal.aborted || (axios.isAxiosError(error) && !error.response && !axios.isCancel(error))) {
      throw new WriteOutcomeUnknownError()
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
