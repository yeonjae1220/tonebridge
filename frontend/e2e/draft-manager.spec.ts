import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
test.use({ locale: 'en-US' })
const editorKey = 'tonebridge-compose-editor:owner'
const value = { kind: 'TEXT', destination: 'FRIEND', selectedFriendId: 'friend-secret-id', targetLanguage: 'en', targetVariant: 'en-US', contentText: 'Draft to continue', context: 'Useful context', selectedGoals: ['발음', '문법'], step: 2, sourceCardId: null }
async function fixture(context: BrowserContext) {
  const state = { owner: 'owner', mutations: 0 }
  await context.addCookies([{ name: 'session', value: 'fixture', domain: '127.0.0.1', path: '/' }, { name: 'tonebridge_ui_language', value: 'en', domain: '127.0.0.1', path: '/' }])
  await context.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.startsWith('/api/auth/')) return route.fulfill({ json: { accessToken: state.owner } })
    if (request.method() !== 'GET') state.mutations++
    if (path === '/api/users/me') return route.fulfill({ json: { id: state.owner, username: state.owner, uiLanguage: 'en', onboardingCompleted: true } })
    if (path === '/api/friends') return route.fulfill({ json: [{ id: 'friend-secret-id', username: 'Alice', nativeLanguage: 'en' }] })
    if (path === '/api/languages/variants') return route.fulfill({ json: { en: [{ code: 'en-US', label: 'American English', labelNative: 'American English', variantType: 'ACCENT' }] } })
    if (path.startsWith('/api/cards/')) return route.fulfill({ json: { id: 'card-one', sessionId: 'session-one', phrase: 'Practice this sentence', tags: [] } })
    return route.fulfill({ json: [] })
  })
  return state
}
async function seed(page: Page, recordings = true) {
  await page.goto('/drafts'); await expect(page.getByText('No saved drafts.')).toBeVisible()
  await page.evaluate(async ({ value, editorKey, recordings }) => {
    localStorage.setItem(editorKey, JSON.stringify({ version: 1, owner: 'owner', revision: 'revision-one', revocation: '', updatedAt: Date.now(), value }))
    if (!recordings) return
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('tonebridge-recording-drafts', 1)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction(['owners', 'drafts'], 'readwrite')
        tx.objectStore('owners').put('epoch', 'owner')
        for (const [owner, scope, age] of [['owner', 'practice:card-one', 0], ['someone-else', 'example:private-card', 0], ['owner', 'example:expired-card', 8 * 86400000]] as const) {
          tx.objectStore('drafts').put({ key: JSON.stringify([owner, scope]), owner, scope, id: 'recording-one', epoch: 'epoch', revocation: '', updatedAt: Date.now() - age, draft: { blob: new Blob(['recording-bytes'], { type: 'audio/webm;codecs=opus' }), duration: 2 } })
        }
        tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = () => reject(tx.error)
      }
    })
  }, { value, editorKey, recordings })
  await page.reload(); await expect(page.getByTestId('managed-editor')).toBeVisible()
}
test('list restores content, exports readable settings and discards only the selected editor', async ({ page, context }, testInfo) => {
  const state = await fixture(context); await seed(page)
  const editor = page.getByTestId('managed-editor')
  await expect(editor).toContainText('Draft to continue')
  await expect(page.getByTestId('managed-recording')).toHaveCount(1)
  await expect(page.getByTestId('managed-recording')).toContainText('Practice this sentence')
  if (process.env.QA_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.QA_ARTIFACT_DIR}/drafts-${testInfo.project.name}.png`, fullPage: true })
  // Names are fetched independently from the local draft without exposing raw friend IDs.
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(e => e.name.includes('/languages/variants')))).toBe(true)
  const event = page.waitForEvent('download'); await editor.getByRole('button', { name: 'Download draft text' }).click()
  const download = await event; const text = await readFile((await download.path())!, 'utf8')
  expect(download.suggestedFilename()).toMatch(/^tonebridge-draft-\d{4}-.*\.txt$/)
  expect(text).toContain('Alice'); expect(text).toContain('English'); expect(text).toContain('American English')
  expect(text).toContain('Pronunciation, Grammar'); expect(text).toContain('Exported at:')
  expect(text).not.toContain('friend-secret-id'); expect(text).not.toContain('발음')
  await editor.getByRole('link', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Context', exact: true })).toHaveValue('Useful context')
  await page.goto('/drafts'); page.once('dialog', dialog => dialog.accept())
  await page.getByTestId('managed-editor').getByRole('button', { name: /Discard/ }).click()
  await expect(page.getByTestId('managed-editor')).toHaveCount(0)
  await page.reload(); await expect(page.getByTestId('managed-recording')).toHaveCount(1)
  expect(state.mutations).toBe(0)
})
test('recording download preserves bytes and discard persists after reload', async ({ page, context }) => {
  await fixture(context); await seed(page)
  const row = page.getByTestId('managed-recording')
  const event = page.waitForEvent('download'); await row.getByRole('button', { name: /Download recording/ }).click()
  const file = await event; expect(file.suggestedFilename()).toMatch(/\.webm$/)
  expect(await readFile((await file.path())!, 'utf8')).toBe('recording-bytes')
  page.once('dialog', d => d.accept()); await row.getByRole('button', { name: /Discard/ }).click()
  await expect(row).toHaveCount(0); await page.reload(); await expect(row).toHaveCount(0)
  await expect(page.getByTestId('managed-editor')).toBeVisible()
})
test('stale editor deletion cannot erase a newer tab revision', async ({ page, context }) => {
  await fixture(context); await seed(page, false)
  // Simulate the write between reading the list and confirming deletion, without a storage event.
  await page.evaluate(key => { const row = JSON.parse(localStorage.getItem(key)!); row.revision = 'newer'; row.value.contentText = 'Newer draft'; localStorage.setItem(key, JSON.stringify(row)) }, editorKey)
  page.once('dialog', d => d.accept()); await page.getByTestId('managed-editor').getByRole('button', { name: /Discard/ }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('draft changed')
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).value.contentText, editorKey)).toBe('Newer draft')
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await expect(page.getByTestId('managed-editor')).toContainText('Newer draft')
})
test('stale recording deletion rejects an updated checkpoint with the same recording id', async ({ page, context }) => {
  await fixture(context); await seed(page)
  await page.evaluate(() => new Promise<void>(resolve => {
    const open = indexedDB.open('tonebridge-recording-drafts', 1)
    open.onsuccess = () => { const db = open.result, tx = db.transaction('drafts', 'readwrite'), rows = tx.objectStore('drafts'), req = rows.get(JSON.stringify(['owner', 'practice:card-one'])); req.onsuccess = () => rows.put({ ...req.result, updatedAt: req.result.updatedAt + 1000 }); tx.oncomplete = () => { db.close(); resolve() } }
  }))
  page.once('dialog', d => d.accept()); await page.getByTestId('managed-recording').getByRole('button', { name: /Discard/ }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('draft changed')
  await page.reload(); await expect(page.getByTestId('managed-recording')).toHaveCount(1)
})
test('pending submission keeps its identity and opens the recovery screen', async ({ page, context }) => {
  const state = await fixture(context); await seed(page, false)
  await page.evaluate(value => localStorage.setItem('tonebridge-composition:owner', JSON.stringify({ owner: 'owner', operation: 'pending-operation', uploaded: false, createdAt: Date.now(), revocation: '', input: { ...value, friendId: value.selectedFriendId, goals: value.selectedGoals, title: '', audioTitle: '' } })), value)
  await page.reload(); const pending = page.getByTestId('pending-draft'); await expect(pending).toBeVisible()
  await expect(pending.getByRole('button', { name: /Discard/ })).toHaveCount(0)
  await pending.getByRole('link', { name: 'Continue' }).click()
  await expect(page.getByRole('button', { name: 'Resume saving' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tonebridge-composition:owner')!).operation)).toBe('pending-operation')
  expect(state.mutations).toBe(0)
})
test('corrupt text storage does not hide recoverable recordings or claim the list is empty', async ({ page, context }) => {
  await fixture(context); await seed(page)
  await page.evaluate(key => localStorage.setItem(key, '{bad-json'), editorKey); await page.reload()
  await expect(page.locator('main').getByRole('alert')).toBeVisible(); await expect(page.getByText('No saved drafts.')).toHaveCount(0)
  await expect(page.getByTestId('managed-recording')).toHaveCount(1)
})
test('another authenticated account cannot see the previous account drafts', async ({ page, context }) => {
  const state = await fixture(context); await seed(page)
  state.owner = 'different-owner'; await page.reload()
  await expect(page.getByText('No saved drafts.')).toBeVisible()
  await expect(page.getByText('Draft to continue')).toHaveCount(0); await expect(page.getByTestId('managed-recording')).toHaveCount(0)
})
test('normal backup details collapse while restored and error recovery remain visible', async ({ page, context }) => {
  await fixture(context); await page.goto('/request'); await page.locator('textarea').fill('Compact normal notice')
  const notice = page.getByTestId('editor-draft')
  await expect(notice.getByRole('status')).toContainText('backed up')
  await expect(notice.locator('details')).not.toHaveAttribute('open', '')
  await expect(notice.getByRole('button', { name: 'Download draft text' })).not.toBeVisible()
  await notice.locator('summary').click(); await expect(notice.getByRole('button', { name: 'Download draft text' })).toBeVisible()
  await page.reload(); await expect(notice).toContainText('Draft and settings restored'); await expect(notice.getByRole('button', { name: 'Download draft text' })).toBeVisible()
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k.startsWith('tonebridge-compose-editor:')) throw new DOMException('quota', 'QuotaExceededError'); original.call(this, k, v) } })
  await page.locator('textarea').fill('Input kept on failure'); await expect(notice.getByRole('alert')).toBeVisible()
  await expect(notice.getByRole('button', { name: 'Retry draft backup' })).toBeVisible()
})
