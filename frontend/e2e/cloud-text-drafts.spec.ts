import { test, expect, type BrowserContext, type Page, type Route } from '@playwright/test'
import { randomUUID } from 'node:crypto'

type Value = Record<string, unknown>
type Row = { id: string; kind: string; scope: string; version: number; state: string; value: Value | null; updatedAt: string; expiresAt: string; pendingOperation: string | null; pendingKind: string | null; pendingPayload: Value | null }
const editor = (text: string): Value => ({ kind: 'TEXT', destination: 'PERSONAL', selectedFriendId: '', targetLanguage: 'en', targetVariant: null, contentText: text, context: '', selectedGoals: [], step: 0, sourceCardId: null })
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function server() {
  return { settings: { enabled: false, epoch: null as string | null, version: 0 }, rows: new Map<string, Row>(),
    history: new Map<string, { version: number; value: Value; createdAt: string; expiresAt: string }[]>(), operations: new Map<string, { id: string | null; version: number }>(),
    receipts: new Map<string, Value>(), writes: [] as Value[], posts: [] as { operation: string; payload: Value }[], settingsWrites: 0,
    holdWrite: false, acceptHeld: true, held: [] as Route[], listStatus: 200, owner: 'owner' }
}
type Server = ReturnType<typeof server>
function save(state: Server, id: string, input: Value) {
  const old = state.rows.get(id), version = (old?.version ?? 0) + 1, now = new Date().toISOString(), expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
  const row: Row = { id, kind: String(input.kind), scope: String(input.scope), version, state: 'ACTIVE', value: copy(input.value as Value), updatedAt: now, expiresAt, pendingOperation: null, pendingKind: null, pendingPayload: null }
  state.rows.set(id, row);state.operations.set(String(input.operationId), { id, version })
  state.history.set(id, [{ version, value: copy(row.value!), createdAt: now, expiresAt }, ...(state.history.get(id) ?? [])].slice(0, 20))
  return { id, version }
}
async function routes(context: BrowserContext, state: Server) {
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
async function seed(page: Page, text: string) {
  await page.goto('/request')
  await expect.poll(() => page.evaluate(() => !!localStorage.getItem('tonebridge-cloud-preferences:owner'))).toBe(true)
  await page.evaluate(value => localStorage.setItem('tonebridge-compose-editor:owner', JSON.stringify({ version: 1, owner: 'owner', revision: 'local-one', revocation: '', updatedAt: Date.now(), value })), editor(text))
  await page.goto('/drafts/cloud');await expect(page.getByText('Sync disabled', { exact: true })).toBeVisible()
}
async function enableAndSelect(page: Page, state: Server, text = 'My original text') {
  await seed(page, text)
  await page.getByRole('button', { name: 'Enable sync', exact: true }).click()
  await expect(page.getByText('Sync enabled', { exact: true })).toBeVisible()
  await page.getByRole('checkbox').check();await page.getByRole('button', { name: 'Upload selected drafts', exact: true }).click()
  await expect.poll(() => state.rows.size).toBe(1)
  await expect(page.getByTestId('cloud-local-binding')).toContainText('Synced')
  await expect(page.getByTestId('cloud-remote-draft')).toHaveCount(1)
}

test('opt-in selects existing drafts, then edits sync and restoration creates history', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  expect(state.writes).toHaveLength(1)
  await page.goto('/request');await page.locator('textarea').first().fill('Edited on this device')
  await expect.poll(() => [...state.rows.values()][0].value?.contentText).toBe('Edited on this device')
  await page.goto('/drafts/cloud');await page.getByRole('button', { name: 'Revision history', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Restore this revision', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Restore this revision', exact: true }).last().click()
  await expect.poll(() => [...state.rows.values()][0].version).toBe(3)
  expect([...state.rows.values()][0].value?.contentText).toBe('My original text')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click()
  await expect(page).toHaveURL(/\/request$/);await expect(page.locator('textarea').first()).toHaveValue('My original text')
})
test('enabling never uploads an unselected existing draft, while a new draft syncs', async ({ page, context }) => {
  const state = server();await routes(context, state);await seed(page, 'Keep this local')
  await page.getByRole('button', { name: 'Enable sync', exact: true }).click();await expect(page.getByText('Sync enabled', { exact: true })).toBeVisible()
  await page.goto('/request');await page.locator('textarea').first().fill('Still local after editing')
  await page.waitForTimeout(1300);expect(state.writes).toHaveLength(0)
  await page.goto('/drafts');page.once('dialog', dialog => dialog.accept());await page.getByTestId('managed-editor').getByRole('button', { name: /Discard/ }).click()
  await page.goto('/request');await page.locator('textarea').first().fill('A new synced draft')
  await expect.poll(() => [...state.rows.values()][0]?.value?.contentText).toBe('A new synced draft')
})
test('unknown accepted sync survives reload and resolves by receipt without another write', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  state.holdWrite = true
  await page.goto('/request');await page.clock.install();await page.locator('textarea').first().fill('Accepted but response lost')
  await page.clock.fastForward(1100);await expect.poll(() => state.writes.length).toBe(2)
  await page.clock.fastForward(30001)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-compose-editor:owner')!).value.contentText)).toBe('Accepted but response lost')
  state.holdWrite = false
  await page.goto('/drafts/cloud');await page.getByRole('button', { name: 'Retry cloud sync', exact: true }).click()
  await expect(page.getByTestId('cloud-local-binding')).toContainText('Synced')
  expect(state.writes).toHaveLength(2)
})
test('a changed remote preserves local text and supports explicit replacement or separate copy', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  const row = [...state.rows.values()][0]
  save(state, row.id, { operationId: randomUUID(), kind: row.kind, scope: row.scope, value: editor('Another device changed this') })
  await page.goto('/request');await page.locator('textarea').first().fill('Keep my local changes')
  await expect(page.getByRole('status').filter({ hasText: 'Cloud sync needs attention' })).toBeVisible()
  await page.goto('/drafts/cloud');await expect(page.getByTestId('cloud-local-binding')).toContainText('cloud version changed')
  await page.getByRole('button', { name: 'Replace cloud version with my text', exact: true }).click()
  await expect.poll(() => state.rows.get(row.id)?.value?.contentText).toBe('Keep my local changes')
  const deleted = state.rows.get(row.id)!;deleted.state = 'DELETED';deleted.value = null;deleted.version++
  await page.goto('/request');await page.locator('textarea').first().fill('Recover as a separate draft')
  await expect(page.getByRole('status').filter({ hasText: 'Cloud sync needs attention' })).toBeVisible()
  await page.goto('/drafts/cloud');await page.getByRole('button', { name: 'Save my text as a separate cloud draft', exact: true }).click()
  await expect.poll(() => [...state.rows.values()].filter(item => item.state === 'ACTIVE').length).toBe(1)
  expect([...state.rows.values()].find(item => item.state === 'ACTIVE')?.id).not.toBe(row.id)
  expect(state.rows.get(row.id)?.state).toBe('DELETED')
})
test('a second device restores the cloud text without overwriting the first device storage', async ({ page, context, browser }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state, 'Portable draft')
  const other = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: page.viewportSize()! });await routes(other, state)
  const second = await other.newPage();await second.goto('/drafts/cloud');await expect(second.getByTestId('cloud-remote-draft')).toContainText('Portable draft')
  second.once('dialog', dialog => dialog.accept());await second.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click()
  await expect(second.locator('textarea').first()).toHaveValue('Portable draft')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-compose-editor:owner')!).value.contentText)).toBe('Portable draft')
  await other.close()
})
test('restored pending composition checks its original receipt and never creates a new operation', async ({ page, context }) => {
  const state = server();state.settings = { enabled: true, epoch: randomUUID(), version: 1 };await routes(context, state)
  const id = randomUUID(), operation = randomUUID()
  save(state, id, { operationId: randomUUID(), kind: 'editor', scope: 'compose', value: editor('Pending text') })
  const row = state.rows.get(id)!;row.pendingOperation = operation;row.pendingKind = 'COMPOSITION';row.pendingPayload = { kind: 'TEXT', destination: 'COMMUNITY', friendId: null, title: '', contentText: 'Pending text', context: '', audioTitle: '', targetLanguage: 'en', targetVariant: null, goals: [] }
  await page.goto('/drafts/cloud');page.once('dialog', dialog => dialog.accept());await page.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click()
  await expect(page).toHaveURL(/\/request$/)
  state.receipts.set(operation, { type: 'community', requestId: randomUUID(), sessionId: null, cardId: null });row.state = 'SUBMITTED';row.value = null
  await page.getByRole('button', { name: 'Resume saving', exact: true }).click()
  await expect(page).toHaveURL(/\/community$/);expect(state.posts).toHaveLength(0)
  expect(await page.evaluate(() => localStorage.getItem('tonebridge-composition:owner'))).toBeNull()
})
test('stopping sync preserves cloud copies and erasing rotates consent without uploading local data', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  await page.getByRole('button', { name: 'Stop sync', exact: true }).click();await expect(page.getByText('Sync disabled', { exact: true })).toBeVisible()
  await page.goto('/request');await page.locator('textarea').first().fill('Local change while stopped');await page.waitForTimeout(1300)
  expect(state.writes).toHaveLength(1);expect(state.rows.size).toBe(1)
  await page.goto('/drafts/cloud');const old = state.settings.epoch
  page.once('dialog', dialog => dialog.accept());await page.getByRole('button', { name: 'Erase cloud drafts and stop sync', exact: true }).click()
  await expect(page.getByText('Cloud drafts erased and sync stopped. Local drafts remain on this device.', { exact: true })).toBeVisible()
  expect(state.rows.size).toBe(0);expect(state.settings.epoch).not.toBe(old)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-compose-editor:owner')!).value.contentText)).toBe('Local change while stopped')
  await page.reload();expect(state.writes).toHaveLength(1)
})
test('cloud read failure is visible and does not hide healthy local text', async ({ page, context }) => {
  const state = server();await routes(context, state);await seed(page, 'Local text survives cloud outage')
  state.listStatus = 503;await page.getByRole('button', { name: 'Refresh drafts', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();await expect(page.getByText('No cloud drafts.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Local text survives cloud outage', { exact: true })).toBeVisible()
})


test('review: a delayed settings read cannot re-enable sync after confirmed stop', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  const before = copy(state.settings);let held: Route | undefined
  await page.route('**/api/users/me/drafts/settings', route => {
    if (route.request().method() === 'GET' && !held) { held = route;return }
    return route.fallback()
  })
  await page.getByRole('button', { name: 'Refresh drafts', exact: true }).click();await expect.poll(() => !!held).toBe(true)
  await page.getByRole('button', { name: 'Stop sync', exact: true }).click();await expect(page.getByText('Sync disabled', { exact: true })).toBeVisible()
  await held!.fulfill({ json: before })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-cloud-preferences:owner')!).enabled)).toBe(false)
  await page.goto('/request');await page.locator('textarea').first().fill('Stay local after late read');await page.waitForTimeout(1300)
  expect(state.writes).toHaveLength(1)
})
test('review: an accepted settings timeout recovers from its stored operation after reload', async ({ page, context }) => {
  const state = server();await routes(context, state);await seed(page, 'Unselected remains local')
  let puts = 0
  await page.route('**/api/users/me/drafts/settings', route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    puts++;const input = route.request().postDataJSON()
    state.settings = { enabled: true, epoch: randomUUID(), version: 1 };state.operations.set(input.operationId, { id: null, version: 1 })
  })
  await page.clock.install();await page.getByRole('button', { name: 'Enable sync', exact: true }).click();await expect.poll(() => puts).toBe(1)
  await page.clock.fastForward(30001);await page.reload()
  await expect(page.getByText('Sync enabled', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('tonebridge-cloud-manager:owner'))).toBeNull()
  expect(puts).toBe(1);expect(state.writes).toHaveLength(0)
})
test('review: cloud metadata quota failure keeps the local editor and sends no unrepeatable write', async ({ page, context }) => {
  const state = server();state.settings = { enabled: true, epoch: randomUUID(), version: 1 };await routes(context, state)
  await context.addInitScript(settings => {
    localStorage.setItem('tonebridge-cloud-preferences:owner', JSON.stringify(settings))
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('tonebridge-cloud-bindings:')) throw new DOMException('quota', 'QuotaExceededError');original.call(this, key, value) }
  }, state.settings)
  await page.goto('/request')
  await page.locator('textarea').first().fill('Local survives cloud metadata quota')
  await expect(page.getByRole('status').filter({ hasText: 'Cloud sync needs attention' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-compose-editor:owner')!).value.contentText)).toBe('Local survives cloud metadata quota')
  expect(state.writes).toHaveLength(0)
})
test('review: explicit logout clears private sync payloads and rejects late completion', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  state.holdWrite = true
  await page.goto('/request');await page.locator('textarea').first().fill('Private queued payload')
  await expect.poll(() => state.held.length).toBe(1)
  await page.goto('/profile/settings');await page.getByRole('button', { name: /Log out/ }).click();await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('tonebridge-cloud-')))).toEqual([])
  const accepted = [...state.operations.values()].find(value => value.id === [...state.rows.keys()][0] && value.version === 2)
  await state.held[0].fulfill({ json: accepted }).catch(() => {})
  expect(await page.evaluate(() => localStorage.getItem('tonebridge-cloud-bindings:owner'))).toBeNull()
  expect(state.rows.size).toBe(1)
})

test('review: a rejected session preserves the queue, while another verified owner cannot replay it', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  await page.route('**/api/users/me/drafts/settings', route => route.fulfill({ status: 401, json: {} }))
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 401, json: {} }))
  await page.getByRole('button', { name: 'Refresh drafts', exact: true }).click();await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => localStorage.getItem('tonebridge-cloud-bindings:owner'))).toContain('My original text')
  const writes = state.writes.length
  await page.unroute('**/api/users/me/drafts/settings');await page.unroute('**/api/auth/refresh')
  state.owner = 'different-owner';state.settings = { enabled: false, epoch: null, version: 0 };state.rows.clear()
  await page.goto('/drafts/cloud');await expect(page.getByText('Sync disabled', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('tonebridge-cloud-bindings:owner'))).toBeNull()
  expect(state.writes).toHaveLength(writes);await expect(page.getByText('My original text', { exact: true })).toHaveCount(0)
})
test('review: a restored pending composition claims and submits exactly its original operation', async ({ page, context }) => {
  const state = server();state.settings = { enabled: true, epoch: randomUUID(), version: 1 };await routes(context, state)
  const id = randomUUID(), operation = randomUUID()
  save(state, id, { operationId: randomUUID(), kind: 'editor', scope: 'compose', value: editor('Pending submission text') })
  const row = state.rows.get(id)!;row.pendingOperation = operation;row.pendingKind = 'COMPOSITION';row.pendingPayload = { kind: 'TEXT', destination: 'COMMUNITY', friendId: null, title: '', contentText: 'Pending submission text', context: '', audioTitle: '', targetLanguage: 'en', targetVariant: null, goals: [] }
  await page.goto('/drafts/cloud');page.once('dialog', dialog => dialog.accept());await page.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click()
  await page.getByRole('button', { name: 'Resume saving', exact: true }).click();await expect(page).toHaveURL(/\/community$/)
  expect(state.posts).toHaveLength(1);expect(state.posts[0].operation).toBe(operation)
  expect(state.rows.get(id)?.state).toBe('SUBMITTED')
  expect(await page.evaluate(() => localStorage.getItem('tonebridge-composition:owner'))).toBeNull()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-cloud-bindings:owner') ?? '{}').compose)).toBeUndefined()
})

test('review: editing after local expiry offers an explicit new copy without reviving the expired ID', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  const row = [...state.rows.values()][0];row.state = 'EXPIRED';row.value = null;row.version++
  await page.evaluate(() => {
    const key = 'tonebridge-cloud-bindings:owner', rows = JSON.parse(localStorage.getItem(key)!)
    rows.compose.updatedAt = Date.now() - 8 * 86400000;localStorage.setItem(key, JSON.stringify(rows))
    const editorKey = 'tonebridge-compose-editor:owner', draft = JSON.parse(localStorage.getItem(editorKey)!)
    draft.updatedAt = Date.now() - 8 * 86400000;localStorage.setItem(editorKey, JSON.stringify(draft))
  })
  await page.reload();await expect(page.getByTestId('cloud-local-binding')).toContainText('7-day retention')
  await page.goto('/request');await page.locator('textarea').first().fill('New text after expiry')
  await page.goto('/drafts/cloud');await expect(page.getByTestId('cloud-local-binding')).toContainText('New text after expiry')
  await page.getByRole('button', { name: 'Save my text as a separate cloud draft', exact: true }).click()
  await expect.poll(() => [...state.rows.values()].filter(value => value.state === 'ACTIVE').length).toBe(1)
  expect(state.rows.get(row.id)?.state).toBe('EXPIRED')
  expect([...state.rows.values()].find(value => value.state === 'ACTIVE')?.value?.contentText).toBe('New text after expiry')
})

test('review: retrying an old erase receipt cannot remove drafts selected after newer consent', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  let erased = false
  await page.route('**/api/users/me/drafts/settings', route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const input = route.request().postDataJSON()
    if (!input.erase) return route.fallback()
    state.settings = { enabled: false, epoch: randomUUID(), version: 2 };state.rows.clear()
    state.operations.set(input.operationId, { id: null, version: 2 });erased = true
  })
  await page.clock.install();page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Erase cloud drafts and stop sync', exact: true }).click();await expect.poll(() => erased).toBe(true)
  await page.clock.fastForward(30001)
  state.settings = { ...state.settings, enabled: true, version: 3 }
  const id = randomUUID();save(state, id, { operationId: randomUUID(), kind: 'editor', scope: 'compose', value: editor('Chosen after consent') })
  await page.evaluate(({ id, settings }) => {
    const key = 'tonebridge-cloud-bindings:owner', rows = JSON.parse(localStorage.getItem(key)!)
    rows.compose.id = id;rows.compose.epoch = settings.epoch;rows.compose.version = 1
    rows.compose.value.contentText = 'Chosen after consent';rows.compose.dirty = false;rows.compose.request = null;rows.compose.error = null
    localStorage.setItem(key, JSON.stringify(rows));localStorage.setItem('tonebridge-cloud-preferences:owner', JSON.stringify(settings))
  }, { id, settings: state.settings })
  await page.reload();await expect(page.getByText('Sync enabled', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('tonebridge-cloud-manager:owner'))).toBeNull()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-cloud-bindings:owner')!).compose.id)).toBe(id)
  expect(state.rows.get(id)?.state).toBe('ACTIVE')
})

test('review: restoration cannot overwrite edits made while the cloud read is delayed', async ({ page, context }) => {
  const state = server();await routes(context, state);await enableAndSelect(page, state)
  const row = [...state.rows.values()][0];let held: Route | undefined
  await page.route('**/api/users/me/drafts/' + row.id, route => {
    if (route.request().method() === 'GET' && !held) { held = route;return }
    return route.fallback()
  })
  page.once('dialog', dialog => dialog.accept());await page.getByRole('button', { name: 'Use cloud version on this device', exact: true }).click()
  await expect.poll(() => !!held).toBe(true)
  await page.evaluate(() => {
    const key = 'tonebridge-compose-editor:owner', draft = JSON.parse(localStorage.getItem(key)!)
    draft.revision = 'another-tab-after-confirmation';draft.value.contentText = 'Latest local edit during cloud read';draft.updatedAt = Date.now()
    localStorage.setItem(key, JSON.stringify(draft))
  })
  await held!.fulfill({ json: row })
  await expect(page.getByRole('main').getByRole('alert')).toContainText('cloud version changed')
  await expect(page).toHaveURL(/\/drafts\/cloud$/)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-compose-editor:owner')!).value.contentText)).toBe('Latest local edit during cloud read')
})
