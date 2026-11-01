'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { recordingDrafts } from '@/lib/recordingDrafts'
import { useAuthStore } from '@/stores/authStore'
import { openEditor, writeEditor, type EditorHandle, type EditorValue } from '@/lib/composeEditorDraft'
import { DraftStorageError, draftStorageIssue, type DraftStorageIssue } from '@/lib/draftStorageError'

export function useComposeEditor(owner: string | undefined, value: EditorValue, enabled: boolean) {
  const { t } = useI18n()
  const generation = useAuthStore(s => s.sessionGeneration)
  const handle = useRef<EditorHandle | undefined>(undefined)
  const paused = useRef(false)
  const queue = useRef(Promise.resolve())
  const sequence = useRef(0)
  const [status, setStatus] = useState<'empty' | 'saving' | 'saved' | 'error'>('empty')
  const [issue, setIssue] = useState<DraftStorageIssue | null>(null)
  const [restored, setRestored] = useState(false)
  const initialize = useCallback((id: string) => {
    handle.current = undefined; paused.current = false; sequence.current++
    setStatus('empty'); setIssue(null); setRestored(false)
    try {
      const opened = openEditor(id)
      handle.current = opened.handle
      setRestored(!!opened.value)
      return opened.value
    } catch (e) { setIssue(draftStorageIssue(e)); setStatus('error') }
  }, [])
  const persist = useCallback((next: EditorValue, replace = false) => {
    if (!owner || paused.current) return Promise.resolve()
    const serial = ++sequence.current
    setStatus('saving')
    const run = queue.current.then(async () => {
      if (paused.current || useAuthStore.getState().sessionGeneration !== generation) return
      // Failure to read initially must not silently replace a draft once storage
      // becomes available. An explicit confirmed retry can replace it.
      if (!handle.current) {
        const opened = openEditor(owner, replace)
        if (opened.value && !replace) throw new DraftStorageError('conflict')
        handle.current = opened.handle
      }
      await writeEditor(handle.current, next, replace)
      if (serial === sequence.current && useAuthStore.getState().sessionGeneration === generation) {
        setStatus('saved'); setIssue(null)
      }
    }).catch(e => {
      if (serial === sequence.current && useAuthStore.getState().sessionGeneration === generation) {
        setStatus('error'); setIssue(draftStorageIssue(e))
      }
    })
    queue.current = run
    return run
  }, [owner, generation])
  useLayoutEffect(() => { if (enabled) void persist(value) }, [enabled, value, persist])
  useEffect(() => {
    if (!enabled || (status !== 'error' && status !== 'saving')) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [enabled, status])
  useEffect(() => {
    if (!enabled || status !== 'error') return
    const leave = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || recordingDrafts.hasUnsaved()) return
      const link = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.hasAttribute('download') || link.target === '_blank') return
      if (link.href === location.href) return
      if (!window.confirm(t('editor.leave'))) { event.preventDefault(); event.stopPropagation() }
    }
    document.addEventListener('click', leave, true)
    return () => document.removeEventListener('click', leave, true)
  }, [enabled, status, t])
  return {
    initialize, status, issue, restored,
    confirmLeave: () => status !== 'error' || window.confirm(t('editor.leave')),
    retry: (replace: boolean) => persist(value, replace),
    pause: async () => { paused.current = true; sequence.current++; await queue.current },
    resume: () => { paused.current = false },
    submitted: async () => {
      if (handle.current) {
        try { await writeEditor(handle.current, null) } catch { /* Keep a newer tab's draft. */ }
      }
    },
  }
}
