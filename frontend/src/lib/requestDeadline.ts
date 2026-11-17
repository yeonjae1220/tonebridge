import axios from 'axios'

export class RequestTimeoutError extends Error {
  constructor() { super('Request timed out'); this.name = 'RequestTimeoutError' }
}

/** Bound the whole request (including interceptors) and cancel obsolete attempts. */
export async function withRequestDeadline<T>(
  request: (signal: AbortSignal) => Promise<T>, milliseconds: number, parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel = () => {}
  const interrupted = new Promise<never>((_resolve, reject) => {
    cancel = () => { reject(new axios.CanceledError('Request cancelled')); controller.abort() }
    parent?.addEventListener('abort', cancel, { once: true })
    if (parent?.aborted) { cancel(); return }
    timer = setTimeout(() => { reject(new RequestTimeoutError()); controller.abort() }, milliseconds)
  })
  try {
    return await Promise.race([
      interrupted,
      controller.signal.aborted ? Promise.reject(new axios.CanceledError()) : request(controller.signal),
    ])
  } finally {
    clearTimeout(timer)
    parent?.removeEventListener('abort', cancel)
  }
}
