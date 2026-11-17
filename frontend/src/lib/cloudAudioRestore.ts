import { recordingDrafts } from './recordingDrafts'
import { captureCloudAccount, readCloudDraft, readCloudSettings, type RemoteDraft } from './cloudDraftSync'
import { downloadCloudRecording } from './cloudAudioSync'
import { cloudBindings, saveCloudBindings, canonical, type CloudSettings } from './cloudDraftLocal'
import { openEditor, writeEditor, validEditor, type EditorValue } from './composeEditorDraft'
import { openRecovery, writeRecovery, type RecoveryValue } from './recoveryDraft'
import { restorePendingComposition, loadComposition, type CompositionInput } from './compositionDraft'
import { validFeedback } from './feedbackDraft'
import { DraftStorageError } from './draftStorageError'
import { api } from './api'
import { withRequestDeadline } from './requestDeadline'

// Capture all local revisions at confirmation, before fetching any remote bytes.
export async function restoreCloudAudioOnDevice(owner: string, shown: RemoteDraft, settings: CloudSettings) {
  const account = captureCloudAccount(owner), scope = shown.scope.slice(6)
  const expected = await recordingDrafts.revision(owner, scope)
  const editor = scope === 'compose' ? openEditor(owner) : null
  const feedback = scope.startsWith('correction-reference:') ? openRecovery(owner, 'feedback:' + scope.split(':')[1]) : null
  const remote = await readCloudDraft(owner, shown.id)
  if (remote.version !== shown.version || remote.state !== 'ACTIVE' || !remote.value || !settings.epoch || !remote.expiresAt || Date.parse(remote.expiresAt) <= Date.now()) throw new DraftStorageError('conflict')
  if (remote.pendingOperation && !remote.pendingPayload) throw new DraftStorageError('unavailable')
  let route = scope === 'compose' ? '/request' : '/correct/' + scope.split(':')[1]
  if (/^(practice|example):/.test(scope)) {
    const card = await withRequestDeadline(signal => api.get<{ sessionId: string }>('/cards/' + scope.split(':')[1], { signal }).then(r => r.data), 15000, account.signal)
    route = '/study/' + encodeURIComponent(card.sessionId) + '/cards/' + encodeURIComponent(scope.split(':')[1])
  }
  const { blob, info } = await downloadCloudRecording(owner, String(remote.value.assetId))
  const [latest, preferences] = await Promise.all([readCloudDraft(owner, remote.id), readCloudSettings(owner)])
  account.check()
  if (latest.state !== 'ACTIVE' || latest.version !== remote.version || preferences.epoch !== settings.epoch) throw new DraftStorageError('conflict')
  if (editor && (openEditor(owner).handle.revision !== editor.handle.revision || loadComposition(owner) && loadComposition(owner)?.operation !== remote.pendingOperation)) throw new DraftStorageError('conflict')
  if (feedback && (openRecovery(owner, feedback.handle.scope).handle.revision !== feedback.handle.revision || feedback.row?.pending && feedback.row.pending.operation !== remote.pendingOperation)) throw new DraftStorageError('conflict')
  const value = remote.value
  if (value.editor && !validEditor(value.editor as EditorValue) || value.feedback && !validFeedback(value.feedback)) throw new DraftStorageError('corrupt')
  const payload = remote.pendingPayload
  if (remote.pendingOperation && scope !== 'compose' && !feedback && (payload?.cardId !== scope.split(':')[1] || payload.purpose !== scope.split(':')[0] || typeof payload.audioKey !== 'string')) throw new DraftStorageError('corrupt')
  if (remote.pendingOperation && scope === 'compose' && (payload?.kind !== 'AUDIO' || typeof payload.title !== 'string' || typeof payload.audioTitle !== 'string' || !validEditor({ ...(value.editor as EditorValue), kind: 'AUDIO', destination: payload.destination, selectedFriendId: payload.friendId ?? '', targetLanguage: payload.targetLanguage, targetVariant: payload.targetVariant, contentText: payload.contentText, context: payload.context, selectedGoals: payload.goals, step: 2, sourceCardId: null } as EditorValue))) throw new DraftStorageError('corrupt')
  if (remote.pendingOperation && feedback && (payload?.requestId !== scope.split(':')[1] || !value.feedback)) throw new DraftStorageError('corrupt')
  const recording = { blob, duration: Number(value.duration) }
  const revision = await recordingDrafts.restore(owner, scope, recording, expected, remote.pendingOperation && payload?.audioKey ? { audioKey: String(payload.audioKey), createdAt: Date.now(), uploaded: true } : undefined)
  account.check()
  if (editor) {
    const context = (value.editor ?? { kind: 'AUDIO', destination: 'PERSONAL', selectedFriendId: '', targetLanguage: '', targetVariant: null, contentText: '', context: '', selectedGoals: [], step: 0, sourceCardId: null }) as EditorValue
    await writeEditor(editor.handle, context)
    if (remote.pendingOperation) await restorePendingComposition(owner, remote.pendingOperation, payload as CompositionInput, Date.parse(remote.updatedAt), recording)
  }
  if (feedback && value.feedback) await writeRecovery(feedback.handle, value.feedback as RecoveryValue, remote.pendingOperation ? { operation: remote.pendingOperation, payload: payload!, recordingId: revision } : null)
  account.check()
  const rows = cloudBindings(owner)
  rows[remote.scope] = { id: remote.id, epoch: settings.epoch, version: remote.version, kind: 'recording', scope: remote.scope, value,
    localRevision: revision, updatedAt: Date.parse(remote.updatedAt), synced: canonical(value), dirty: false, pendingLocal: !!remote.pendingOperation,
    submissionOperation: remote.pendingOperation ?? undefined, request: null, error: null,
    audio: { sourceId: revision, sourceUpdatedAt: Date.now(), assetId: info.id, sha256: info.sha256, byteSize: info.byteSize, contentType: info.contentType, ready: true } }
  saveCloudBindings(owner, rows)
  return route
}
