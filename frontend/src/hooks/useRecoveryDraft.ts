import { useCallback, useEffect, useLayoutEffect, useRef, useState, type SetStateAction } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { useAuthStore } from '@/stores/authStore'
import { openRecovery, writeRecovery, type PendingSubmission, type RecoveryHandle, type RecoveryValue } from '@/lib/recoveryDraft'
import { uploadCloudRecording } from '@/lib/cloudAudioSync'
import { prepareCloudSubmission } from '@/lib/cloudDraftSync'
import { DraftStorageError, draftStorageIssue, type DraftStorageIssue } from '@/lib/draftStorageError'

export function useRecoveryDraft<T extends RecoveryValue>(owner: string | undefined, scope: string, initial: T, valid: (value: unknown) => value is T) {
  const { t } = useI18n()
  const sequence = useRef(0)
  const [value, setState] = useState(initial)
  const dirty = useRef(false)
  const latest = useRef(value); latest.current = value
  const [pending, setPending] = useState<PendingSubmission | null>(null)
  const pendingRef = useRef(pending)
  const beginFlight = useRef<Promise<PendingSubmission> | null>(null)
  const [ready, setReady] = useState(false)
  const [restored, setRestored] = useState(false)
  const [status, setStatus] = useState<'empty' | 'saving' | 'saved' | 'error'>('empty')
  const [issue, setIssue] = useState<DraftStorageIssue | null>(null)
  const handle = useRef<RecoveryHandle | undefined>(undefined)
  const queue = useRef(Promise.resolve())
  const paused = useRef(false)
  const mounted = useRef(true)
  const generation = useAuthStore(s => s.sessionGeneration)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const initialize = useCallback(() => {
    if (!owner) return
    try {
      const opened = openRecovery(owner, scope)
      const saved = opened.row?.value
      if (saved) {
        if (!valid(saved)) throw new DraftStorageError('corrupt')
        setState(saved); latest.current = saved; setRestored(true)
      }
      handle.current = opened.handle
      pendingRef.current = opened.row?.pending ?? null
      setPending(pendingRef.current); paused.current = !!pendingRef.current
      setIssue(null); setStatus(opened.row?.value ? 'saved' : 'empty'); setReady(true)
    } catch (error) {
      // Do not let an empty editor replace a draft or pending receipt we could not read.
      handle.current = undefined; setReady(false)
      setIssue(draftStorageIssue(error)); setStatus('error')
    }
  }, [owner, scope, valid])
  useEffect(initialize, [initialize])
  const persist = useCallback((next: T) => {
    if (paused.current) return queue.current
    const serial = ++sequence.current
    setStatus('saving')
    const run = queue.current.then(async () => {
      if (paused.current || serial !== sequence.current) return
      if (!handle.current) throw new DraftStorageError('unavailable')
      if (!valid(next)) throw new DraftStorageError('quota')
      await writeRecovery(handle.current, next, null)
      if (mounted.current && serial === sequence.current && generation === useAuthStore.getState().sessionGeneration) { setStatus('saved'); setIssue(null) }
    }).catch(error => {
      if (mounted.current && serial === sequence.current && generation === useAuthStore.getState().sessionGeneration) { setIssue(draftStorageIssue(error)); setStatus('error') }
    })
    queue.current = run
    return run
  }, [generation, valid])
  useLayoutEffect(() => { if (ready && !pending && dirty.current) void persist(value) }, [ready, value, pending, persist])
  useEffect(() => {
    if (status !== 'saving' && status !== 'error') return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [status])
  useEffect(() => {
    if (status !== 'error' && status !== 'saving') return
    const leave = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.hasAttribute('download') || link.target === '_blank' || link.href === location.href) return
      if (!window.confirm(t('editor.leave'))) { event.preventDefault(); event.stopPropagation() }
    }
    document.addEventListener('click', leave, true)
    return () => document.removeEventListener('click', leave, true)
  }, [status, t])
  const setValue = (next: SetStateAction<T>) => { if (!pendingRef.current) { dirty.current = true; setState(next) } }
  return { value, setValue, pending, ready, restored, status, issue,
    preparePending: async (submission: PendingSubmission, signal?: AbortSignal) => {
      if (!owner) throw new DraftStorageError('unavailable')
      const receipt = await prepareCloudSubmission(owner, scope, submission.operation, 'SUBMISSION', submission.payload, signal)
      if (receipt || !scope.startsWith('feedback:')) return receipt
      const audioScope = 'audio:correction-reference:' + scope.split(':')[1]
      await uploadCloudRecording(owner, audioScope)
      return prepareCloudSubmission(owner, audioScope, submission.operation, 'SUBMISSION', submission.payload, signal)
    },
    confirmLeave: () => (status !== 'error' && status !== 'saving') || window.confirm(t('editor.leave')),
    retry: () => handle.current ? persist(latest.current) : initialize(),
    begin: (payload: Record<string, unknown>, recordingId?: string, signal?: AbortSignal): Promise<PendingSubmission> => {
      signal?.throwIfAborted()
      if (pendingRef.current) return Promise.resolve(pendingRef.current)
      if (beginFlight.current) return beginFlight.current
      // Same-screen concurrent callers share the identity too, before React disables the button.
      const flight = (async () => {
        paused.current = true
        await queue.current
        try {
          signal?.throwIfAborted()
          if (!handle.current) throw new DraftStorageError('unavailable')
          if (!valid(latest.current)) throw new DraftStorageError('quota')
          const next = { operation: crypto.randomUUID(), payload, recordingId }
          await writeRecovery(handle.current, latest.current, next, signal)
          pendingRef.current = next; if (mounted.current) { setPending(next); setStatus('saved'); setIssue(null) }
          return next
        } catch (error) { paused.current = false; if (mounted.current) { setIssue(draftStorageIssue(error)); setStatus('error') }; throw error }
      })()
      beginFlight.current = flight
      void flight.finally(() => { if (beginFlight.current === flight) beginFlight.current = null }).catch(() => {})
      return flight
    },
    resumeEditing: async (signal?: AbortSignal) => {
      if (!handle.current) throw new DraftStorageError('unavailable')
      await writeRecovery(handle.current, latest.current, null, signal)
      pendingRef.current = null; paused.current = false
      if (mounted.current) { setPending(null); setStatus('saved'); setIssue(null) }
    },
    clear: async () => {
      paused.current = true; await queue.current
      if (handle.current) await writeRecovery(handle.current, null, null)
    },
  }
}
