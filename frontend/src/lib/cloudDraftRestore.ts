import { useAuthStore } from '@/stores/authStore'
import { openEditor, writeEditor, validEditor, type EditorValue } from './composeEditorDraft'
import { openRecovery, writeRecovery, type PendingSubmission, type RecoveryValue } from './recoveryDraft'
import { loadComposition, restorePendingComposition, type CompositionInput } from './compositionDraft'
import { validFeedback, validCardDraft } from './feedbackDraft'
import { cloudBindings, saveCloudBindings, canonical, type CloudSettings } from './cloudDraftLocal'
import { type RemoteDraft } from './cloudDraftSync'
import { DraftStorageError } from './draftStorageError'

export function cloudLocalRevision(owner: string, remote: RemoteDraft) {
  return remote.kind === 'editor' ? openEditor(owner).handle.revision : openRecovery(owner, remote.scope).handle.revision
}
export async function restoreCloudOnDevice(owner: string, remote: RemoteDraft, settings: CloudSettings, expectedLocalRevision: string | undefined) {
  const generation = useAuthStore.getState().sessionGeneration
  const same = () => { if (!useAuthStore.getState().accessToken || generation !== useAuthStore.getState().sessionGeneration) throw new DraftStorageError('conflict') }
  if (!settings.epoch || remote.state !== 'ACTIVE' || !remote.value || !remote.expiresAt || Date.parse(remote.expiresAt) <= Date.now()) throw new DraftStorageError('conflict')
  if (remote.pendingOperation && !remote.pendingPayload) throw new DraftStorageError('unavailable')
  let revision: string
  if (remote.kind === 'editor') {
    const value = remote.value as EditorValue
    if (!validEditor(value) || value.kind !== 'TEXT' || remote.scope !== 'compose') throw new DraftStorageError('corrupt')
    const pending = loadComposition(owner)
    if (pending && pending.operation !== remote.pendingOperation) throw new DraftStorageError('conflict')
    const opened = openEditor(owner)
    if (opened.handle.revision !== expectedLocalRevision) throw new DraftStorageError('conflict')
    if (remote.pendingOperation) {
      const input = remote.pendingPayload as CompositionInput
      const portable = input && input.kind === 'TEXT' && validEditor({ ...value, kind: input.kind, destination: input.destination, selectedFriendId: input.friendId ?? '', targetLanguage: input.targetLanguage, targetVariant: input.targetVariant,
        contentText: input.contentText, context: input.context, selectedGoals: input.goals, step: 2, sourceCardId: null })
        && typeof input.title === 'string' && input.title.length <= 100 && typeof input.audioTitle === 'string' && input.audioTitle.length <= 100
      if (!portable) throw new DraftStorageError('corrupt')
      await restorePendingComposition(owner, remote.pendingOperation, input, Date.parse(remote.updatedAt))
    }
    same(); await writeEditor(opened.handle, value); same()
    if (openEditor(owner).handle.revision !== opened.handle.revision) throw new DraftStorageError('conflict')
    revision = opened.handle.revision!
  } else {
    if (!(remote.kind === 'feedback' ? validFeedback(remote.value) : validCardDraft(remote.value))) throw new DraftStorageError('corrupt')
    const opened = openRecovery(owner, remote.scope)
    if (opened.handle.revision !== expectedLocalRevision) throw new DraftStorageError('conflict')
    if (opened.row?.pending && opened.row.pending.operation !== remote.pendingOperation) throw new DraftStorageError('conflict')
    if (remote.pendingOperation) {
      const payload = remote.pendingPayload!
      if (remote.kind === 'feedback' ? payload.requestId !== remote.scope.split(':')[1] : payload.sessionId !== remote.value.sessionId) throw new DraftStorageError('corrupt')
    }
    const pending: PendingSubmission | null = remote.pendingOperation ? { operation: remote.pendingOperation, payload: remote.pendingPayload! } : null
    await writeRecovery(opened.handle, remote.value as RecoveryValue, pending); same()
    if (openRecovery(owner, remote.scope).handle.revision !== opened.handle.revision) throw new DraftStorageError('conflict')
    revision = opened.handle.revision!
  }
  same()
  const rows = cloudBindings(owner)
  rows[remote.scope] = { id: remote.id, epoch: settings.epoch, version: remote.version, kind: remote.kind, scope: remote.scope, value: remote.value,
    localRevision: revision, updatedAt: Date.parse(remote.updatedAt), synced: canonical(remote.value), dirty: false, pendingLocal: !!remote.pendingOperation,
    submissionOperation: remote.pendingOperation ?? undefined, request: null, error: null }
  saveCloudBindings(owner, rows)
}
export function cloudDraftRoute(row: Pick<RemoteDraft, 'kind' | 'scope'>) {
  if (row.kind === 'editor') return '/request'
  const parts = row.scope.split(':')
  if (row.kind === 'feedback') return '/correct/' + encodeURIComponent(parts[1])
  if (parts[0] === 'card-new') return '/study/' + encodeURIComponent(parts[1]) + '?create=1'
  return '/result/' + encodeURIComponent(parts[1]) + '?save=' + encodeURIComponent(parts[2])
}
