import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test'
import { randomUUID, createHash } from 'node:crypto'

type Value = Record<string, unknown>
type Row = { id: string; kind: string; scope: string; version: number; state: string; value: Value | null; updatedAt: string; expiresAt: string; pendingOperation: string | null; pendingKind: string | null; pendingPayload: Value | null }
const editor = (text: string): Value => ({ kind: 'TEXT', destination: 'PERSONAL', selectedFriendId: '', targetLanguage: 'en', targetVariant: null, contentText: text, context: '', selectedGoals: [], step: 0, sourceCardId: null })
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function textServer() {
  return { settings: { enabled: false, epoch: null as string | null, version: 0 }, rows: new Map<string, Row>(),
    history: new Map<string, { version: number; value: Value; createdAt: string; expiresAt: string }[]>(), operations: new Map<string, { id: string | null; version: number }>(),
    receipts: new Map<string, Value>(), writes: [] as Value[], posts: [] as { operation: string; payload: Value }[], settingsWrites: 0,
    holdWrite: false, acceptHeld: true, held: [] as Route[], listStatus: 200, owner: 'owner' }
}
type Server = ReturnType<typeof textServer>
function save(state: Server, id: string, input: Value) {
  const old = state.rows.get(id), version = (old?.version ?? 0) + 1, now = new Date().toISOString(), expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
  const row: Row = { id, kind: String(input.kind), scope: String(input.scope), version, state: 'ACTIVE', value: copy(input.value as Value), updatedAt: now, expiresAt, pendingOperation: null, pendingKind: null, pendingPayload: null }
  state.rows.set(id, row);state.operations.set(String(input.operationId), { id, version })
  state.history.set(id, [{ version, value: copy(row.value!), createdAt: now, expiresAt }, ...(state.history.get(id) ?? [])].slice(0, 20))
  return { id, version }
}
async function textRoutes(context: BrowserContext, state: Server) {
  await context.addCookies([{ name: 'session', value: 'fixture', domain: '127.0.0.1', path: '/' }, { name: 'tonebridge_ui_language', value: 'en', domain: '127.0.0.1', path: '/' }])
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method()
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value })
    if (path.startsWith('/api/auth/')) return json({ accessToken: 'cloud-fixture-' + state.owner })
    if (path === '/api/users/me' || path === '/api/users/me/profile') return json({ id: state.owner, email: 'fixture@example.test', username: state.owner, nativeLanguage: 'en', uiLanguage: 'en', fluentLanguages: [], learningLanguages: ['en'], onboardingCompleted: true, reputationScore: 5, correctorLevel: 'NATIVE', badges: [], correctionStreak: 0 })
    if (path === '/api/users/me/drafts/settings') {
      if (method === 'GET') return json(state.settings)
      const input = request.postDataJSON();state.settingsWrites++
      if (state.operations.has(input.operationId)) return json(state.settings)
      if (input.expectedVersion !== state.settings.version) return json({}, 409)
      state.settings = { enabled: input.enabled, epoch: input.erase || !state.settings.epoch ? randomUUID() : state.settings.epoch, version: state.settings.version + 1 }
      if (input.erase) state.rows.clear()
      state.operations.set(input.operationId, { id: null, version: state.settings.version });return json(state.settings)
    }
    if (path === '/api/users/me/drafts') return state.listStatus === 200 ? json([...state.rows.values()].filter(row => row.state === 'ACTIVE')) : json({}, state.listStatus)
    const operation = path.match(/^\/api\/users\/me\/drafts\/operations\/(.+)$/)
    if (operation) return state.operations.has(operation[1]) ? json(state.operations.get(operation[1])) : json({}, 404)
    const match = path.match(/^\/api\/users\/me\/drafts\/([^/]+)(.*)$/)
    if (match) {
      const [, id, suffix] = match, row = state.rows.get(id)
      if (suffix === '/history') return json(state.history.get(id) ?? [])
      if (!suffix && method === 'GET') return row ? json(row) : json({}, 404)
      const input = request.postDataJSON()
      if (suffix === '/prepare-submission') {
        if (!row || row.state !== 'ACTIVE' || (row.pendingOperation && row.pendingOperation !== input.operation)) return json({}, 409)
        if (!row.pendingOperation) { if (row.version !== input.expectedVersion) return json({}, 409);row.version++;row.pendingOperation = input.operation;row.pendingKind = input.kind;row.pendingPayload = state.settings.enabled ? input.payload : null }
        return json(row)
      }
      if (state.operations.has(input.operationId)) return json(state.operations.get(input.operationId))
      if (input.epoch !== state.settings.epoch) return json({}, 409)
      if (suffix === '/delete') {
        if (!row || row.pendingOperation || row.version !== input.expectedVersion) return json({}, 409)
        row.version++;row.state = 'DELETED';row.value = null;state.history.delete(id)
        const result = { id, version: row.version };state.operations.set(input.operationId, result);return json(result)
      }
      const restore = suffix.match(/^\/history\/(\d+)\/restore$/)
      if (restore) {
        const previous = state.history.get(id)?.find(item => item.version === Number(restore[1]))
        if (!row || !previous || row.version !== input.expectedVersion || !state.settings.enabled) return json({}, 409)
        return json(save(state, id, { ...input, kind: row.kind, scope: row.scope, value: previous.value }))
      }
      if (!suffix && method === 'PUT') {
        state.writes.push(copy(input))
        if (!state.settings.enabled || (row ? row.state !== 'ACTIVE' || row.pendingOperation || row.version !== input.expectedVersion : input.expectedVersion !== 0)) return json({}, 409)
        const result = !state.holdWrite || state.acceptHeld ? save(state, id, input) : null
        if (state.holdWrite) { state.held.push(route);return }
        return json(result)
      }
    }
    const composition = path.match(/^\/api\/compositions\/([^/]+)(.*)$/)
    if (composition) {
      const [, id, suffix] = composition
      if (suffix === '/cancel') {
        for (const row of state.rows.values()) if (row.pendingOperation === id) { row.pendingOperation = null;row.pendingKind = null;row.pendingPayload = null;row.version++ }
        return route.fulfill({ status: 204 })
      }
      if (method === 'GET') return state.receipts.has(id) ? json(state.receipts.get(id)) : json({}, 404)
      state.posts.push({ operation: id, payload: request.postDataJSON() })
      const result = state.receipts.get(id) ?? { type: 'community', requestId: randomUUID(), sessionId: null, cardId: null };state.receipts.set(id, result)
      for (const row of state.rows.values()) if (row.pendingOperation === id) { row.state = 'SUBMITTED';row.value = null;row.pendingOperation = null;row.version++ }
      return json(result)
    }
    if (path === '/api/languages/variants') return json({})
    if (path.startsWith('/api/correction-requests')) return json({ items: [], nextPage: null })
    return json([])
  })
}

function wave() {
  const bytes = Buffer.alloc(44 + 16000 * 2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length - 8, 4);bytes.write('WAVEfmt ', 8);bytes.writeUInt32LE(16, 16);bytes.writeUInt16LE(1, 20);bytes.writeUInt16LE(1, 22);bytes.writeUInt32LE(16000, 24);bytes.writeUInt32LE(32000, 28);bytes.writeUInt16LE(2, 32);bytes.writeUInt16LE(16, 34);bytes.write('data', 36);bytes.writeUInt32LE(bytes.length - 44, 40)
  for (let i = 0; i < 16000; i++) bytes.writeInt16LE(Math.round(Math.sin(i * Math.PI / 20) * 1000), 44 + i * 2)
  return bytes
}
function server() { return Object.assign(textServer(), { settings: { enabled: true, audioEnabled: false, epoch: randomUUID(), version: 1 }, assets: new Map<string, { id: string; state: string; byteSize: number; contentType: string; sha256: string; bytes?: Buffer }>(), puts: 0, reserves: 0, lostPut: false, corrupt: false, heldDownload: null as Route | null, holdDownload: false }) }
async function routes(context: BrowserContext, state: ReturnType<typeof server>) {
  await textRoutes(context, state)
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method(), json = (value: unknown, status = 200) => route.fulfill({ status, json: value })
    if (path === '/api/users/me/drafts/settings/audio') {
      const input = request.postDataJSON()
      if (input.expectedVersion !== state.settings.version) return json({}, 409)
      state.settings.audioEnabled = input.enabled;state.settings.version++
      state.operations.set(input.operationId, { id: null, version: state.settings.version });return json(state.settings)
    }
    if (path === '/api/users/me/drafts/settings' && method === 'PUT') { const input = request.postDataJSON();if (!input.enabled) state.settings.audioEnabled = false }
    const asset = path.match(/^\/api\/users\/me\/draft-audio\/([^/]+)(\/file)?$/)
    if (asset) {
      const id = asset[1], current = state.assets.get(id)
      if (!asset[2]) {
        if (method === 'GET') return current ? json({ ...current, bytes: undefined }) : json({}, 404)
        state.reserves++;const input = request.postDataJSON();const next = { ...input, id, state: 'RESERVED' };state.assets.set(id, next);return json(next)
      }
      if (!current) return json({}, 404)
      if (method === 'PUT') { state.puts++;current.bytes = request.postDataBuffer()!;current.state = 'READY';if (state.lostPut) return route.abort();return json({ ...current, bytes: undefined }) }
      if (state.holdDownload) { state.heldDownload = route;return }
      return route.fulfill({ contentType: current.contentType, body: state.corrupt ? Buffer.from('corrupt') : current.bytes! })
    }
    return route.fallback()
  })
}
async function seedAudio(page: Page, interrupted = false, changed = false) {
  await page.goto('/drafts/cloud');await expect(page.getByTestId('cloud-audio-panel')).toBeVisible()
  const id = randomUUID(), bytes = [...wave()];if (changed) bytes[60] ^= 1
  await page.evaluate(async ({ id, bytes, interrupted }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('tonebridge-recording-drafts', 1)
      request.onupgradeneeded = () => { request.result.createObjectStore('drafts', { keyPath: 'key' });request.result.createObjectStore('owners') }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction(['drafts', 'owners'], 'readwrite')
        tx.objectStore('owners').put('epoch', 'owner')
        tx.objectStore('drafts').put({ key: JSON.stringify(['owner', 'compose']), owner: 'owner', scope: 'compose', id, epoch: 'epoch', revocation: '', updatedAt: Date.now(), draft: { blob: new Blob([new Uint8Array(bytes)], { type: 'audio/wav' }), duration: 1, interrupted } })
        tx.oncomplete = () => { db.close();resolve() };tx.onerror = () => reject(tx.error)
      }
    })
    localStorage.setItem('tonebridge-compose-editor:owner', JSON.stringify({ version: 1, owner: 'owner', revision: 'editor-one', revocation: '', updatedAt: Date.now(), value: { kind: 'AUDIO', destination: 'PERSONAL', selectedFriendId: '', targetLanguage: 'en', targetVariant: null, contentText: '', context: '', selectedGoals: [], step: 0, sourceCardId: null } }))
  }, { id, bytes, interrupted })
  await page.reload();await expect(page.getByTestId('cloud-audio-panel')).toBeVisible();return id
}
async function selected(page: Page, state: ReturnType<typeof server>) {
  await seedAudio(page)
  await page.getByRole('button', { name: 'Enable audio sync', exact: true }).click()
  await expect.poll(() => state.settings.audioEnabled).toBe(true)
  await page.getByTestId('cloud-audio-panel').getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Upload selected recordings', exact: true }).click()
  await expect.poll(() => state.rows.size).toBe(1)
  await expect(page.getByTestId('cloud-local-binding')).toContainText('Synced')
}
async function play(page: Page) {
  const audio = page.locator('audio').first();await expect(audio).toBeAttached()
  await audio.evaluate(async (a: HTMLAudioElement) => a.play())
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0)
  expect(await audio.evaluate((a: HTMLAudioElement) => a.error)).toBeNull()
}
test('audio needs separate consent and explicit selection; immutable bytes play after full reload', async ({ page, context }) => {
  const state = server();await routes(context, state);await seedAudio(page)
  await page.waitForTimeout(1200);expect(state.reserves).toBe(0)
  await page.getByRole('button', { name: 'Enable audio sync', exact: true }).click()
  await page.waitForTimeout(1200);expect(state.reserves).toBe(0)
  await page.getByTestId('cloud-audio-panel').getByRole('checkbox').check();await page.getByRole('button', { name: 'Upload selected recordings', exact: true }).click()
  await expect.poll(() => state.rows.size).toBe(1);expect(state.puts).toBe(1)
  await page.reload();await page.getByRole('button', { name: 'Play recording', exact: true }).click();await play(page)
  expect([...state.assets.values()][0].sha256).toBe(createHash('sha256').update(wave()).digest('hex'))
})
test('completed recording after consent auto-syncs while interrupted recordings remain local', async ({ page, context }) => {
  const state = server();state.settings.audioEnabled = true;await routes(context, state);const id = await seedAudio(page, true)
  expect(await page.getByTestId('cloud-audio-panel').getByRole('checkbox').count()).toBe(0)
  await page.evaluate(id => window.dispatchEvent(new CustomEvent('tonebridge-recording-complete', { detail: { owner: 'owner', scope: 'compose', id } })), id)
  await page.waitForTimeout(1200);expect(state.puts).toBe(0)
  const complete = await seedAudio(page)
  await page.evaluate(id => window.dispatchEvent(new CustomEvent('tonebridge-recording-complete', { detail: { owner: 'owner', scope: 'compose', id } })), complete)
  await expect.poll(() => state.puts).toBe(1);await expect.poll(() => state.rows.size).toBe(1)
})
test('lost upload response is resolved by asset status without uploading bytes twice', async ({ page, context }) => {
  const state = server();state.lostPut = true;await routes(context, state);await seedAudio(page)
  await page.getByRole('button', { name: 'Enable audio sync', exact: true }).click();await page.getByTestId('cloud-audio-panel').getByRole('checkbox').check();await page.getByRole('button', { name: 'Upload selected recordings', exact: true }).click()
  await expect.poll(() => state.puts).toBe(1);await expect(page.getByTestId('cloud-local-binding')).toContainText('could not finish')
  state.lostPut = false;await page.reload();await page.getByRole('button', { name: 'Retry cloud sync', exact: true }).click()
  await expect.poll(() => state.rows.size).toBe(1);expect(state.puts).toBe(1);expect(state.reserves).toBe(1)
})
test('another device restores verified audio durably and actually plays after full reload', async ({ page, context, browser }) => {
  const state = server();await routes(context, state);await selected(page, state)
  const other = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: page.viewportSize()! });await routes(other, state)
  const second = await other.newPage();await second.goto('/drafts/cloud');second.once('dialog', d => d.accept());await second.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click()
  await expect(second).toHaveURL(/\/request$/);await second.reload();await play(second)
  expect(state.puts).toBe(1);await other.close()
})
test('bad downloaded bytes preserve local data and do not create a binding', async ({ page, context, browser }) => {
  const state = server();await routes(context, state);await selected(page, state);state.corrupt = true
  const other = await browser.newContext({ baseURL: new URL(page.url()).origin });await routes(other, state)
  const second = await other.newPage();await second.goto('/drafts/cloud');second.once('dialog', d => d.accept());await second.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click()
  await expect(second.getByRole('alert')).toBeVisible();expect(await second.evaluate(() => localStorage.getItem('tonebridge-cloud-bindings:owner'))).toBeNull()
  expect(second.url()).toContain('/drafts/cloud');await other.close()
})
test('a delayed audio restore cannot overwrite a newer recording on the device', async ({ page, context }) => {
  const state = server();await routes(context, state);await selected(page, state);state.holdDownload = true
  page.once('dialog', d => d.accept());await page.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click();await expect.poll(() => !!state.heldDownload).toBe(true)
  await page.evaluate(async () => { await new Promise<void>(resolve => { const request = indexedDB.open('tonebridge-recording-drafts');request.onsuccess = () => { const db = request.result, tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts'), get = store.get(JSON.stringify(['owner', 'compose']));get.onsuccess = () => store.put({ ...get.result, id: 'newer-recording', updatedAt: Date.now() });tx.oncomplete = () => { db.close();resolve() } } }) })
  await state.heldDownload!.fulfill({ contentType: 'audio/wav', body: wave() });await expect(page.getByRole('alert')).toBeVisible();expect(page.url()).toContain('/drafts/cloud')
})
test('stopping audio sync retains playable cloud copies and never reuploads', async ({ page, context }) => {
  const state = server();await routes(context, state);await selected(page, state)
  await page.getByRole('button', { name: 'Stop audio sync', exact: true }).click();await expect.poll(() => state.settings.audioEnabled).toBe(false)
  await page.reload();await page.getByRole('button', { name: 'Play recording', exact: true }).click();await play(page);expect(state.puts).toBe(1);expect(state.rows.size).toBe(1)
})

test('pending audio composition restores its original operation and receipt without another upload or submission', async ({ page, context, browser }) => {
  const state = server();await routes(context, state);await selected(page, state)
  const row = [...state.rows.values()][0], operation = randomUUID();row.version++;row.pendingOperation = operation;row.pendingKind = 'COMPOSITION';row.pendingPayload = { kind: 'AUDIO', destination: 'COMMUNITY', friendId: null, title: '', contentText: '', context: '', audioTitle: 'My audio', targetLanguage: 'en', targetVariant: null, goals: [] }
  const other = await browser.newContext({ baseURL: new URL(page.url()).origin });await routes(other, state)
  const second = await other.newPage();await second.goto('/drafts/cloud');second.once('dialog', d => d.accept());await second.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click()
  await expect(second).toHaveURL(/\/request$/);await expect.poll(() => second.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-composition:owner') ?? 'null')?.operation)).toBe(operation)
  state.receipts.set(operation, { type: 'community', requestId: randomUUID(), sessionId: null, cardId: null });row.state = 'SUBMITTED';row.value = null
  await second.getByRole('button', { name: 'Resume saving', exact: true }).click();await expect(second).toHaveURL(/\/community$/)
  expect(state.posts).toHaveLength(0);expect(state.puts).toBe(1);await other.close()
})
test('linked recording discard waits for cloud deletion and a network failure leaves playable local audio', async ({ page, context }) => {
  const state = server();await routes(context, state);await selected(page, state)
  let reject = true
  await context.route('**/api/users/me/drafts/*/delete', route => reject ? route.fulfill({ status: 503, json: {} }) : route.fallback())
  await page.goto('/request');await expect(page.getByRole('button', { name: 'Discard draft', exact: true })).toBeVisible()
  page.once('dialog', d => d.accept());await page.getByRole('button', { name: 'Discard draft', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Cloud deletion did not finish' })).toBeVisible();expect([...state.rows.values()][0].state).toBe('ACTIVE');await play(page)
  reject = false;page.once('dialog', d => d.accept());await page.getByRole('button', { name: 'Discard draft', exact: true }).click()
  await expect.poll(() => [...state.rows.values()][0].state).toBe('DELETED')
  await page.reload();await expect(page.getByRole('button', { name: 'Discard draft', exact: true })).toHaveCount(0)
})
test('audio context edits update the existing asset without reuploading its bytes', async ({ page, context }) => {
  const state = server();await routes(context, state);await selected(page, state)
  await page.goto('/request');await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => ([...state.rows.values()][0].value?.editor as Value)?.step).toBe(1)
  expect(state.puts).toBe(1);expect(state.reserves).toBe(1)
})
test('logout during an audio download cannot restore another account or retain the blob', async ({ page, context }) => {
  const state = server();await routes(context, state);await selected(page, state);state.holdDownload = true
  page.once('dialog', d => d.accept());await page.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click();await expect.poll(() => !!state.heldDownload).toBe(true)
  await page.goto('/profile/settings');await page.getByRole('button', { name: /Log out/ }).click();await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('tonebridge-cloud-')))).toEqual([])
  await state.heldDownload!.fulfill({ contentType: 'audio/wav', body: wave() }).catch(() => {})
  expect(page.url()).toContain('/login')
})

test('a definitively failed upload retries with a new reservation while an unknown ready upload does not', async ({ page, context }) => {
  const state = server();state.lostPut = true;await routes(context, state);await seedAudio(page)
  await page.getByRole('button', { name: 'Enable audio sync', exact: true }).click();await page.getByTestId('cloud-audio-panel').getByRole('checkbox').check();await page.getByRole('button', { name: 'Upload selected recordings', exact: true }).click()
  await expect(page.getByTestId('cloud-local-binding')).toContainText('could not finish')
  const failed = [...state.assets.values()][0];failed.state = 'DELETING';state.lostPut = false
  await page.getByRole('button', { name: 'Retry cloud sync', exact: true }).click();await expect.poll(() => state.rows.size).toBe(1)
  expect(state.reserves).toBe(2);expect(state.puts).toBe(2);expect([...state.rows.values()][0].value?.assetId).not.toBe(failed.id)
})
test('cloud deletion during a file download prevents restoring the removed version', async ({ page, context }) => {
  const state = server();await routes(context, state);await selected(page, state);state.holdDownload = true
  page.once('dialog', d => d.accept());await page.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click();await expect.poll(() => !!state.heldDownload).toBe(true)
  const row = [...state.rows.values()][0];row.state = 'DELETED';row.version++;row.value = null
  await state.heldDownload!.fulfill({ contentType: 'audio/wav', body: wave() });await expect(page.getByRole('alert')).toBeVisible();expect(page.url()).toContain('/drafts/cloud')
})
for (const purpose of ['practice', 'example'] as const) test(`restored pending ${purpose} checks its original receipt without uploading or submitting again`, async ({ page, context, browser }) => {
  const state = server();await routes(context, state);await selected(page, state)
  const row = [...state.rows.values()][0], operation = randomUUID(), card = randomUUID(), session = randomUUID()
  row.scope = `audio:${purpose}:${card}`;row.value = { assetId: row.value!.assetId, duration: 1 };row.pendingOperation = operation;row.pendingKind = 'SUBMISSION';row.pendingPayload = { cardId: card, purpose, audioKey: 'audio/original/recording.wav' };row.version++
  const other = await browser.newContext({ baseURL: new URL(page.url()).origin });await routes(other, state)
  let receiptReads = 0, writes = 0
  await other.route('**/api/cards/' + card, route => route.fulfill({ json: { id: card, sessionId: session, createdByUserId: 'owner', phrase: 'Saved audio', tags: [], position: 0, createdAt: new Date().toISOString() } }))
  await other.route('**/api/submissions/**', route => { expect(route.request().url()).toContain(operation);receiptReads++;return route.fulfill({ json: { type: purpose, resourceId: randomUUID(), parentId: card } }) })
  await other.route('**/api/storage/presigned-upload', route => { writes++;return route.fulfill({ status: 500, json: {} }) })
  const second = await other.newPage();await second.goto('/drafts/cloud');second.once('dialog', d => d.accept());await second.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click()
  await expect(second).toHaveURL(new RegExp('/cards/' + card + '$'));await second.getByRole('button', { name: purpose === 'practice' ? 'Save practice' : 'Save example', exact: true }).click()
  await expect.poll(() => receiptReads).toBe(1);expect(writes).toBe(0);expect(state.puts).toBe(1)
  await expect.poll(() => second.evaluate(scope => JSON.parse(localStorage.getItem('tonebridge-cloud-bindings:owner') ?? '{}')[scope], row.scope)).toBeUndefined()
  await other.close()
})

test('an uploaded orphan that expires before draft linking can recover from local bytes with a new asset', async ({ page, context }) => {
  const state = server();await routes(context, state);let failing = true
  await context.route('**/api/users/me/drafts/*', route => route.request().method() === 'PUT' && !route.request().url().endsWith('/settings') && failing ? route.fulfill({ status: 503, json: {} }) : route.fallback())
  await seedAudio(page);await page.getByRole('button', { name: 'Enable audio sync', exact: true }).click();await page.getByTestId('cloud-audio-panel').getByRole('checkbox').check();await page.getByRole('button', { name: 'Upload selected recordings', exact: true }).click()
  await expect(page.getByTestId('cloud-local-binding')).toContainText('could not finish');expect(state.rows.size).toBe(0)
  const orphan = [...state.assets.values()][0];orphan.state = 'DELETED';failing = false
  await page.getByRole('button', { name: 'Retry cloud sync', exact: true }).click();await expect.poll(() => state.rows.size).toBe(1)
  expect([...state.rows.values()][0].value?.assetId).not.toBe(orphan.id);expect(state.puts).toBe(2)
  await expect(page.getByTestId('cloud-local-binding')).toContainText('Synced')
})

test('after a remote conflict a newer local recording is used by explicit keep-mine without overwriting automatically', async ({ page, context }) => {
  const state = server();await routes(context, state);await selected(page, state)
  const old = [...state.rows.values()][0], originalAsset = old.value!.assetId
  save(state, old.id, { operationId: randomUUID(), kind: old.kind, scope: old.scope, value: { ...old.value, duration: 2 } })
  await page.reload();await expect(page.getByTestId('cloud-local-binding')).toContainText('cloud version changed')
  await seedAudio(page, false, true)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-cloud-bindings:owner')!)['audio:compose'].audio.ready)).toBe(false)
  expect(state.puts).toBe(1);expect(state.rows.get(old.id)?.value?.duration).toBe(2)
  await page.getByRole('button', { name: 'Retry cloud sync', exact: true }).click();await expect.poll(() => state.puts).toBe(2)
  expect(state.rows.get(old.id)?.value?.duration).toBe(2)
  await page.getByRole('button', { name: 'Replace cloud version with my recording', exact: true }).click()
  await expect.poll(() => state.rows.get(old.id)?.value?.assetId).not.toBe(originalAsset)
  expect(state.rows.get(old.id)?.value?.duration).toBe(1)
})

test('explicit separate copy after cloud erasure uploads a new asset under the new consent epoch', async ({ page, context }) => {
  const state = server();await routes(context, state);await selected(page, state)
  const old = [...state.rows.values()][0], oldAsset = old.value!.assetId
  old.state = 'DELETED';old.value = null;old.version++;state.settings.epoch = randomUUID();state.settings.version++
  for (const asset of state.assets.values()) asset.state = 'DELETED'
  await page.reload();await expect(page.getByTestId('cloud-local-binding')).toContainText('cloud version changed')
  await page.getByRole('button', { name: 'Save my recording as a separate cloud draft', exact: true }).click()
  await expect.poll(() => [...state.rows.values()].filter(row => row.state === 'ACTIVE').length).toBe(1)
  const copied = [...state.rows.values()].find(row => row.state === 'ACTIVE')!
  expect(copied.id).not.toBe(old.id);expect(copied.value?.assetId).not.toBe(oldAsset);expect(old.state).toBe('DELETED');expect(state.puts).toBe(2)
})
