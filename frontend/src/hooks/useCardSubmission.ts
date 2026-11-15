import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { captureAccountGuard } from '@/lib/validationDiagnostics'
import { withWriteDeadline } from '@/lib/writeDeadline'
import { type CardDraftValue, type SubmissionResult } from '@/lib/feedbackDraft'
import { useRecoveryDraft } from './useRecoveryDraft'

export type SavedCard = { id: string; sessionId: string }
export function useCardSubmission(draft: ReturnType<typeof useRecoveryDraft<CardDraftValue>>, onSaved: (card: SavedCard) => void) {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  return useMutation({
    mutationFn: (action: 'save' | 'edit') => withWriteDeadline(async signal => {
      const sameAccount = captureAccountGuard()
      if (action === 'edit' && draft.pending) {
        const { data } = await api.post<SubmissionResult>(`/submissions/${draft.pending.operation}/cancel`, null, { signal })
        sameAccount()
        if (data.type === 'cancelled' || data.type === 'unavailable') { await draft.resumeEditing(signal); return null }
        return { id: data.resourceId!, sessionId: data.parentId! }
      }
      const { sessionId, phrase, context, tags } = draft.value
      const submission = await draft.begin({ sessionId, phrase: phrase.trim(), context: context.trim() || null, tags }, undefined, signal)
      sameAccount()
      const payload = submission.payload
      const { data } = await api.post(`/sessions/${encodeURIComponent(String(payload.sessionId))}/cards`, {
        phrase: payload.phrase, context: payload.context, tags: payload.tags,
      }, { signal, headers: { 'Idempotency-Key': submission.operation } })
      sameAccount()
      return { id: data.id as string, sessionId: typeof data.sessionId === 'string' ? data.sessionId : String(payload.sessionId) }
    }),
    onSuccess: async card => {
      if (!card) return
      try { await draft.clear() } catch { /* Keep the receipt or another tab's newer draft; replay is safe. */ }
      if (mounted.current) onSaved(card)
    },
    onError: () => {},
  })
}
