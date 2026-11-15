/** Cancel the queued lock request, so a suspended tab cannot cause a late stale write. */
export async function withDraftLock(name: string, write: () => void, signal?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timer = setTimeout(abort, 5_000)
  try {
    await navigator.locks.request(name, { signal: controller.signal }, () => {
      controller.signal.throwIfAborted()
      write()
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
