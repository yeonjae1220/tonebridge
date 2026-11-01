import { DraftStorageError, draftStorageIssue, type DraftStorageIssue } from './draftStorageError'
import { useAuthStore } from '@/stores/authStore'
import { finalizeRecording } from '@/lib/audioDuration'

export type RecordingDraft = { blob: Blob; duration: number; interrupted?: boolean }
export type DraftStatus = 'loading' | 'saving' | 'saved' | 'error' | 'empty'
export type SavedUpload = { audioKey: string; createdAt: number; uploaded: true }
type Row = {
  key: string; owner: string; scope: string; id: string; epoch: string; revocation: string; updatedAt: number
  draft: RecordingDraft | null; upload?: SavedUpload
}
export type RecordingDraftSnapshot = Pick<Row, 'owner' | 'scope' | 'id' | 'epoch' | 'revocation' | 'updatedAt'> & { draft: RecordingDraft }
type Entry = {
  owner: string; scope: string; epoch: string; revocation: string; id: string; expectedId: string | undefined
  issue?: DraftStorageIssue; draft?: RecordingDraft; status: DraftStatus; restored: boolean; upload?: SavedUpload
}
const entries = new Map<string, Entry>()
const active = new Set<string>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

const MAX_AGE = 7 * 24 * 60 * 60_000
const MAX_BYTES = 50 * 1024 * 1024
const DB_NAME = 'tonebridge-recording-drafts'
let queue = Promise.resolve<unknown>(undefined)
let channel: BroadcastChannel | undefined
let remoteLogout = false
let authenticatedOwner: string | undefined
const REVOCATION_PREFIX = 'tonebridge-draft-revoked:'
function revocation(owner: string) {
  try { return localStorage.getItem(REVOCATION_PREFIX + owner) ?? '' } catch { return '' }
}

function current(key: string) {
  return !!useAuthStore.getState().accessToken && key.startsWith(`${useAuthStore.getState().sessionGeneration}:`)
}

// No tokens or signed upload URLs are persisted. Writes check the account's
// durable epoch and row revision, including writes from another tab.
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    let expired = false
    const timer = setTimeout(() => { expired = true; reject(new Error('Draft storage unavailable')) }, 4000)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts', { keyPath: 'key' })
      request.result.createObjectStore('owners')
    }
    request.onerror = () => { clearTimeout(timer); reject(request.error) }
    request.onblocked = () => { expired = true; clearTimeout(timer); reject(new Error('Draft storage blocked')) }
    request.onsuccess = () => {
      clearTimeout(timer)
      if (expired) { request.result.close(); return }
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
  })
}

async function transaction<T>(run: (rows: IDBObjectStore, owners: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await database()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(['drafts', 'owners'], 'readwrite')
    let value: T
    const timer = setTimeout(() => { tx.abort() }, 4000)
    tx.oncomplete = () => { clearTimeout(timer); db.close(); resolve(value) }
    tx.onabort = tx.onerror = () => { clearTimeout(timer); db.close(); reject(tx.error ?? new Error('Draft transaction failed')) }
    try { run(tx.objectStore('drafts'), tx.objectStore('owners'), (next) => { value = next }) }
    catch (error) { tx.abort(); reject(error) }
  })
}

function serial<T>(run: () => Promise<T>): Promise<T> {
  const result = queue.then(run)
  queue = result.catch(() => undefined)
  return result
}

function connect() {
  if (channel || typeof BroadcastChannel === 'undefined') return
  channel = new BroadcastChannel(DB_NAME)
  channel.onmessage = ({ data }) => {
    if (data?.type === 'logout' && authenticatedOwner === data.owner) {
      remoteLogout = true
      useAuthStore.getState().logout()
      remoteLogout = false
    }
    if (data?.type === 'removed') {
      for (const [key, entry] of entries) {
        if (entry.owner === data.owner && entry.scope === data.scope && entry.id === data.id) {
          entry.draft = undefined; entry.upload = undefined; entry.status = 'empty'; active.delete(key)
          entry.id = data.revision; entry.expectedId = data.revision
        }
      }
      emit()
    }
  }
}

function invalidate(owner: string) {
  // A small synchronous revocation marker also covers closing during asynchronous
  // logout cleanup. It contains no audio or credentials and never gates authentication.
  try { localStorage.setItem(REVOCATION_PREFIX + owner, crypto.randomUUID()) } catch { /* IndexedDB cleanup still runs. */ }
  return serial(() => transaction<void>((rows, owners, done) => {
    owners.put(crypto.randomUUID(), owner)
    const cursor = rows.openCursor()
    cursor.onsuccess = () => {
      if (!cursor.result) { done(); return }
      if ((cursor.result.value as Row).owner === owner) cursor.result.delete()
      cursor.result.continue()
    }
  }))
}

useAuthStore.subscribe((state, previous) => {
  if (state.sessionGeneration === previous.sessionGeneration) return
  const owners = new Set([...entries.values()].map((entry) => entry.owner))
  if (authenticatedOwner) owners.add(authenticatedOwner)
  authenticatedOwner = undefined
  entries.clear(); active.clear(); emit()
  for (const owner of owners) {
    if (!remoteLogout) {
      channel?.postMessage({ type: 'logout', owner })
      void invalidate(owner).catch(() => { /* Storage errors are handled by the persistence status. */ })
    }
  }
})

async function persist(key: string, entry: Entry): Promise<boolean> {
  entry.status = 'saving'; entry.issue = undefined; emit()
  const draft = entry.draft, upload = entry.upload, id = entry.id
  let failure: DraftStorageIssue | undefined
  try {
    await serial(async () => {
      if (!current(key) || entries.get(key) !== entry || entry.id !== id) throw new DraftStorageError('conflict')
      if (draft && draft.blob.size > MAX_BYTES) throw new DraftStorageError('quota')
      await transaction<void>((rows, owners, done) => {
        const epochRequest = owners.get(entry.owner)
        epochRequest.onsuccess = () => {
          if (epochRequest.result !== entry.epoch || revocation(entry.owner) !== entry.revocation || !current(key) || entry.id !== id) { rows.transaction.abort(); return }
          const request = rows.get(JSON.stringify([entry.owner, entry.scope]))
          request.onsuccess = () => {
            const previous = request.result as Row | undefined
            if (previous?.id !== entry.expectedId) { failure = 'conflict'; rows.transaction.abort(); return }
            let bytes = draft?.blob.size ?? 0
            const cursor = rows.openCursor()
            cursor.onsuccess = () => {
              if (cursor.result) {
                const row = cursor.result.value as Row
                if (row.key !== previous?.key) bytes += row.draft?.blob.size ?? 0
                cursor.result.continue(); return
              }
              if (bytes > 100 * 1024 * 1024) { failure = 'quota'; rows.transaction.abort(); return }
              if (entry.id !== id || !current(key)) { failure = 'conflict'; rows.transaction.abort(); return }
              try {
                rows.put({ key: JSON.stringify([entry.owner, entry.scope]), owner: entry.owner, scope: entry.scope,
                  id, epoch: entry.epoch, revocation: entry.revocation, updatedAt: Date.now(), draft: draft ?? null, upload } satisfies Row)
                done()
              } catch (e) { failure = draftStorageIssue(e); rows.transaction.abort() }
            }
          }
        }
      })
      entry.expectedId = id
    })
    if (entries.get(key) === entry && current(key) && entry.id === id) {
      entry.status = entry.draft === draft ? (draft ? 'saved' : 'empty') : 'saving'
      emit()
    }
    return true
  } catch (e) {
    if (entries.get(key) === entry && current(key) && entry.id === id) { entry.status = 'error'; entry.issue = failure ?? draftStorageIssue(e); emit() }
    return false
  }
}

export const recordingDrafts = {
  async list(owner: string): Promise<RecordingDraftSnapshot[]> {
    const generation = useAuthStore.getState().sessionGeneration
    const token = revocation(owner)
    const allowed = () => !!useAuthStore.getState().accessToken && authenticatedOwner === owner
      && useAuthStore.getState().sessionGeneration === generation && revocation(owner) === token
    if (!allowed()) throw new DraftStorageError('conflict')
    const result = await serial(() => transaction<RecordingDraftSnapshot[]>((rows, owners, done) => {
      const epoch = owners.get(owner)
      epoch.onsuccess = () => {
        const found: RecordingDraftSnapshot[] = []
        const cursor = rows.openCursor()
        cursor.onsuccess = () => {
          const item = cursor.result
          if (!item) { done(found); return }
          const row = item.value as Row
          if (row.owner === owner && row.epoch === epoch.result && row.revocation === token
            && Date.now() - row.updatedAt <= MAX_AGE && row.draft
            && (row.scope === 'compose' || /^(practice|example):[^:]+$/.test(row.scope))) {
            found.push({ owner, scope: row.scope, id: row.id, epoch: row.epoch, revocation: row.revocation, updatedAt: row.updatedAt, draft: row.draft })
          }
          item.continue()
        }
      }
    }))
    if (!allowed()) throw new DraftStorageError('conflict')
    return result.sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async discardSnapshot(snapshot: RecordingDraftSnapshot) {
    const generation = useAuthStore.getState().sessionGeneration
    const allowed = () => !!useAuthStore.getState().accessToken && authenticatedOwner === snapshot.owner
      && useAuthStore.getState().sessionGeneration === generation && revocation(snapshot.owner) === snapshot.revocation
    if (!allowed()) throw new DraftStorageError('conflict')
    const revision = crypto.randomUUID()
    await serial(() => transaction<void>((rows, owners, done) => {
      const epoch = owners.get(snapshot.owner)
      epoch.onsuccess = () => {
        const request = rows.get(JSON.stringify([snapshot.owner, snapshot.scope]))
        request.onsuccess = () => {
          const row = request.result as Row | undefined
          if (!allowed() || epoch.result !== snapshot.epoch || row?.id !== snapshot.id || row.updatedAt !== snapshot.updatedAt) {
            rows.transaction.abort(); return
          }
          rows.put({ ...row, id: revision, updatedAt: Date.now(), draft: null, upload: undefined })
          done()
        }
      }
    }))
    if (!allowed()) return
    for (const [key, entry] of entries) {
      if (entry.owner === snapshot.owner && entry.scope === snapshot.scope && entry.id === snapshot.id) {
        entry.draft = undefined; entry.upload = undefined; entry.status = 'empty'; entry.restored = false
        entry.id = revision; entry.expectedId = revision; active.delete(key)
      }
    }
    channel?.postMessage({ type: 'removed', owner: snapshot.owner, scope: snapshot.scope, id: snapshot.id, revision })
    emit()
  },
  bindOwner(owner: string) { authenticatedOwner = owner; connect() },
  settled: () => queue,
  get: (key: string) => entries.get(key)?.draft,
  info: (key: string) => entries.get(key),
  isActive: (key: string) => active.has(key),
  async load(key: string, owner: string, scope: string) {
    connect()
    if (entries.has(key) || !current(key)) return
    const entry: Entry = { owner, scope, epoch: '', revocation: revocation(owner), id: crypto.randomUUID(), expectedId: undefined, status: 'loading', restored: false }
    entries.set(key, entry); emit()
    try {
      const restored = await serial(() => transaction<{ row?: Row; epoch: string }>((rows, owners, done) => {
        const epochRequest = owners.get(owner)
        epochRequest.onsuccess = () => {
          const epoch: string = epochRequest.result ?? crypto.randomUUID()
          try { if (!epochRequest.result) owners.put(epoch, owner) } catch { rows.transaction.abort(); return }
          const cursor = rows.openCursor()
          let row: Row | undefined
          cursor.onsuccess = () => {
            if (!cursor.result) { done({ row, epoch }); return }
            const stored = cursor.result.value as Row
            if (Date.now() - stored.updatedAt > MAX_AGE || stored.revocation !== revocation(stored.owner)) cursor.result.delete()
            else if (stored.owner === owner && stored.scope === scope && stored.epoch === epoch) row = stored
            cursor.result.continue()
          }
        }
      }))
      if (restored.row?.draft?.interrupted) {
        restored.row.draft = { ...await finalizeRecording(restored.row.draft.blob, restored.row.draft.duration), interrupted: true }
      }
      if (!current(key) || entries.get(key) !== entry || entry.revocation !== revocation(owner)) return
      entry.epoch = restored.epoch
      entry.expectedId = restored.row?.id
      if (restored.row?.draft) {
        entry.id = restored.row.id; entry.draft = restored.row.draft; entry.upload = restored.row.upload; entry.restored = true
      }
      entry.status = entry.draft ? 'saved' : 'empty'
    } catch (e) { if (current(key) && entries.get(key) === entry) { entry.status = 'error'; entry.issue = draftStorageIssue(e) } }
    emit()
  },
  set(key: string, draft: RecordingDraft, checkpoint = false) {
    const entry = entries.get(key)
    if (!entry || !current(key)) return
    if (checkpoint && entry.status === 'saving') return
    entry.draft = draft
    if (!checkpoint) active.delete(key)
    void persist(key, entry)
  },
  delete(key: string) {
    const entry = entries.get(key)
    active.delete(key)
    if (!entry || !current(key)) return
    entry.draft = undefined; entry.upload = undefined; entry.restored = false
    const removedId = entry.id
    // Tombstone keeps stale tabs from resurrecting an explicitly discarded recording.
    entry.id = crypto.randomUUID()
    const revision = entry.id
    void persist(key, entry).then((ok) => {
      if (ok) channel?.postMessage({ type: 'removed', owner: entry.owner, scope: entry.scope, id: removedId, revision })
    })
    emit()
  },
  markActive(key: string) {
    const entry = entries.get(key)
    if (!entry) return
    entry.id = crypto.randomUUID(); entry.restored = false; entry.upload = undefined
    entry.status = 'empty'
    active.add(key); emit()
  },
  retry: async (key: string) => {
    const entry = entries.get(key)
    if (!entry) return
    if (entry.epoch) await persist(key, entry)
    else {
      const draft = entry.draft
      entries.delete(key)
      await recordingDrafts.load(key, entry.owner, entry.scope)
      const loaded = entries.get(key)
      if (draft && loaded && !loaded.draft) { loaded.draft = draft; await persist(key, loaded) }
      else if (draft && loaded) { entries.set(key, entry); emit() }
    }
  },
  async saveUpload(blob: Blob, upload: SavedUpload) {
    await queue
    const found = [...entries].find(([, entry]) => entry.draft?.blob === blob)
    if (!found) return
    const [key, entry] = found
    entry.upload = upload
    if (entry.status === 'saved' && !await persist(key, entry)) throw new Error('Draft checkpoint failed')
  },
  getUpload: (blob: Blob) => [...entries.values()].find((entry) => entry.draft?.blob === blob)?.upload,
  hasUnsaved: () => active.size > 0 || [...entries.values()].some((entry) => !!entry.draft),
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
}
