import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
test.use({ locale: 'en-US' })
async function fixture(context: BrowserContext) {
  await context.addCookies([
    { name: 'session', value: 'fixture', domain: '127.0.0.1', path: '/' },
    { name: 'tonebridge_ui_language', value: 'en', domain: '127.0.0.1', path: '/' },
  ])
  const state = { puts: 0, saves: [] as { id: string; body: Record<string, unknown> }[], fail: true,
    lostResponse: false, failPut: false, completed: new Map<string, object>(), keys: [] as string[], cancelled: [] as string[], bytes: [] as Buffer[] }
  await context.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.startsWith('/api/auth/')) return route.fulfill({ json: { accessToken: 'owner' } })
    if (path === '/api/users/me') return route.fulfill({ json: { id: 'owner', username: 'Owner', uiLanguage: 'en', onboardingCompleted: true, nativeLanguage: 'ko', learningLanguages: ['en'], fluentLanguages: [] } })
    if (path === '/api/users/me/profile') return route.fulfill({ json: { username: 'Owner', correctorLevel: 'NATIVE', reputationScore: 0, correctionStreak: 0, badges: [], nativeLanguage: 'ko', learningLanguages: ['en'], fluentLanguages: [] } })
    if (path === '/api/friends') return route.fulfill({ json: [{ id: 'friend', username: 'Partner', nativeLanguage: 'en' }] })
    if (path === '/api/practice-feedback') return route.fulfill({ json: { items: [], nextPage: null } })
    const match = path.match(/^\/api\/compositions\/([^/]+)(.*)$/)
    if (match) {
      const [, id, suffix] = match
      if (suffix === '/upload-url') {
        state.keys.push(id)
        return route.fulfill({ json: { audioKey: id, uploadUrl: 'http://127.0.0.1:3100/compose-put' } })
      }
      if (suffix === '/cancel') {
        if (state.completed.has(id)) return route.fulfill({ json: state.completed.get(id) })
        state.cancelled.push(id)
        return route.fulfill({ status: 204 })
      }
      if (req.method() === 'GET') return route.fulfill({ status: state.completed.has(id) ? 200 : 404, json: state.completed.get(id) ?? {} })
      const body = req.postDataJSON()
      state.saves.push({ id, body })
      const result = body.destination === 'COMMUNITY' ? { type: 'community', requestId: id } : { type: 'study', sessionId: 'saved-session', cardId: id }
      if (!state.fail || state.lostResponse) state.completed.set(id, result)
      if (state.lostResponse) return route.abort('failed')
      return route.fulfill({ status: state.fail ? 503 : 200, json: result })
    }
    if (path.startsWith('/api/cards/')) return route.fulfill({ json: path.endsWith('/attempts') || path.endsWith('/native-audios') ? [] : {
      id: path.split('/').at(-1), sessionId: 'saved-session', createdByUserId: 'owner', phrase: 'Saved', tags: [], createdAt: '2026-11-01T00:00:00Z',
    } })
    if (path === '/api/correction-requests/feed/page') return route.fulfill({ json: { items: [], nextCursor: null } })
    return route.fulfill({ json: [] })
  })
  await context.route('**/compose-put', route => {
    state.puts++
    state.bytes.push(route.request().postDataBuffer() ?? Buffer.alloc(0))
    return route.fulfill({ status: state.failPut ? 503 : 200 })
  })
  return state
}
async function compose(page: Page, destination: string, kind: string, submit = true) {
  await page.goto('/request')
  if (kind === 'AUDIO') {
    await page.getByRole('button', { name: 'Audio', exact: true }).click()
    await page.getByRole('button', { name: 'Start recording', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Start recording', exact: true }).click()
    await page.waitForTimeout(450)
    await page.getByRole('dialog').getByRole('button', { name: 'Stop recording', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByTestId('draft-notice')).toContainText('Backed up in this browser')
  } else await page.locator('textarea').fill('Hello from recovery test')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  if (destination === 'FRIEND') {
    await page.getByRole('button', { name: /Send to a friend/ }).click()
    await page.getByRole('combobox').selectOption('friend')
  } else if (destination === 'COMMUNITY') await page.getByRole('button', { name: /Ask the community/ }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  if (destination === 'COMMUNITY') await page.getByRole('button', { name: /English/ }).click()
  await page.locator('input').fill('Keep this context')
  await page.getByRole('button', { name: /Pronunciation/, exact: true }).click()
  if (submit) await page.locator('section > div').last().getByRole('button').last().click()
}

const key = 'tonebridge-compose-editor:owner'
async function backup(page: Page) {
  await expect(page.getByTestId('editor-draft').getByRole('status')).toContainText(/backed up|restored/)
}
async function reloadEditor(page: Page) {
  page.once('dialog', d => d.accept().catch(() => {}))
  await page.reload(); page.removeAllListeners('dialog')
  await expect(page.getByTestId('editor-draft')).toContainText('Draft and settings restored')
}
for (const destination of ['PERSONAL', 'FRIEND', 'COMMUNITY']) {
  test(`unsubmitted ${destination} text and settings survive reload and tab close`, async ({ page, context }) => {
    const state = await fixture(context)
    await compose(page, destination, 'TEXT', false); await backup(page)
    await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k)!).value.selectedGoals, key)).toEqual(['발음'])
    const before = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).value, key)
    expect(before).toMatchObject({ contentText: 'Hello from recovery test', context: 'Keep this context', destination, step: 2, selectedGoals: ['발음'] })
    expect(before.selectedFriendId).toBe(destination === 'FRIEND' ? 'friend' : '')
    if (destination === 'COMMUNITY') expect(before.targetLanguage).toBe('en')
    await reloadEditor(page)
    await expect(page.getByRole('textbox', { name: 'Context', exact: true })).toHaveValue(before.context)
    await page.close(); const reopened = await context.newPage(); await reopened.goto('/request')
    await expect(reopened.getByTestId('editor-draft')).toContainText('Draft and settings restored')
    expect(await reopened.evaluate(k => JSON.parse(localStorage.getItem(k)!).value, key)).toEqual(before)
    expect(state.saves).toHaveLength(0)
    state.fail = false
    await reopened.getByRole('button', { name: destination === 'PERSONAL' ? 'Save' : destination === 'FRIEND' ? 'Send to a friend' : 'Request correction', exact: true }).click()
    await expect.poll(() => state.saves.length).toBe(1)
    expect(state.saves[0].body).toMatchObject({ destination, contentText: before.contentText, context: before.context, goals: before.selectedGoals })
    await expect.poll(() => reopened.evaluate(k => JSON.parse(localStorage.getItem(k)!).value, key)).toBeNull()
  })
}
for (const reason of ['SecurityError', 'QuotaExceededError']) {
  test(`${reason} keeps input, exports it, and retries without reload`, async ({ page, context }) => {
    const state = await fixture(context)
    await page.addInitScript(({ reason }) => {
      const original = Storage.prototype.setItem
      Object.assign(window, { allowDraftStorage: false })
      Storage.prototype.setItem = function(k, v) {
        if (k.startsWith('tonebridge-compose-editor:') && !(window as unknown as { allowDraftStorage: boolean }).allowDraftStorage) throw new DOMException('fixture', reason)
        original.call(this, k, v)
      }
    }, { reason })
    await compose(page, 'FRIEND', 'TEXT', false)
    const notice = page.getByTestId('editor-draft')
    await expect(notice.getByRole('alert')).toContainText(reason === 'SecurityError' ? 'browser blocked' : 'Not enough space')
    await expect(notice).toContainText('Keep this screen open without reloading')
    const download = page.waitForEvent('download'); await notice.getByRole('button', { name: 'Download draft text' }).click()
    const file = await download; const contents = await readFile((await file.path())!, 'utf8')
    expect(contents).toContain('Hello from recovery test'); expect(contents).toContain('Keep this context'); expect(contents).toContain('Send to a friend')
    await page.evaluate(() => Object.assign(window, { allowDraftStorage: true }))
    await notice.getByRole('button', { name: 'Retry draft backup' }).click(); await backup(page)
    await expect(page.getByRole('textbox', { name: 'Context', exact: true })).toHaveValue('Keep this context')
    expect(state.saves).toHaveLength(0)
    await reloadEditor(page)
  })
}
test('two editors keep conflicting text without silently replacing the saved draft', async ({ page, context }) => {
  await fixture(context); await page.goto('/request'); await page.locator('textarea').fill('First tab'); await backup(page)
  const second = await context.newPage(); await second.goto('/request'); await expect(second.locator('textarea')).toHaveValue('First tab')
  await second.locator('textarea').fill('Second tab saved change'); await backup(second)
  await page.locator('textarea').fill('Unsaved first tab change')
  await expect(page.getByTestId('editor-draft')).toContainText('Another tab changed the draft')
  await expect(second.locator('textarea')).toHaveValue('Second tab saved change')
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).value.contentText, key)).toBe('Second tab saved change')
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Retry draft backup' }).click(); await backup(page)
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).value.contentText, key)).toBe('Unsaved first tab change')
  await second.locator('textarea').fill('Second tab change')
  await expect(second.getByTestId('editor-draft')).toContainText('Another tab changed the draft')
})
test('a restored source-card draft is not overwritten by the source API', async ({ page, context }) => {
  await fixture(context); await page.goto('/request?sourceCard=source')
  await expect(page.locator('textarea')).toHaveValue('Saved')
  await page.locator('textarea').fill('My edited source'); await backup(page)
  await reloadEditor(page); await expect(page.locator('textarea')).toHaveValue('My edited source')
})
test('expired draft is not restored and corrupt draft requires explicit replacement', async ({ page, context }) => {
  await fixture(context); await page.goto('/request'); await page.locator('textarea').fill('Expired'); await backup(page)
  await page.evaluate(k => { const row = JSON.parse(localStorage.getItem(k)!); row.updatedAt = Date.now() - 8 * 86400000; localStorage.setItem(k, JSON.stringify(row)) }, key)
  await page.reload(); await expect(page.locator('textarea')).toHaveValue(''); await backup(page)
  await page.evaluate(k => localStorage.setItem(k, '{broken'), key); await page.reload()
  await expect(page.getByTestId('editor-draft')).toContainText('stored draft could not be read')
  await page.locator('textarea').fill('Kept in this screen')
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('{broken')
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Retry draft backup' }).click(); await backup(page)
  await reloadEditor(page); await expect(page.locator('textarea')).toHaveValue('Kept in this screen')
})
test('logout removes the editor draft and a different account cannot restore it', async ({ page, context }) => {
  await fixture(context); await page.goto('/request'); await page.locator('textarea').fill('Private owner draft'); await backup(page)
  await page.goto('/profile'); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: /Log out/ }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBeNull()
  await context.route('**/api/users/me', route => route.fulfill({ json: { id: 'other', username: 'Other', uiLanguage: 'en', onboardingCompleted: true, nativeLanguage: 'ko', learningLanguages: ['en'], fluentLanguages: [] } }))
  await page.goto('/request'); await expect(page.locator('textarea')).toHaveValue('')
})
test('audio snapshot quota failure keeps audio and text downloadable without a server write', async ({ page, context }) => {
  const state = await fixture(context)
  await compose(page, 'PERSONAL', 'AUDIO', false)
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function(value, key) {
      if (value?.scope?.startsWith('compose-submit:')) throw new DOMException('fixture', 'QuotaExceededError')
      return key === undefined ? original.call(this, value) : original.call(this, value, key)
    }
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByTestId('editor-draft')).toContainText('Not enough space')
  await expect(page.getByTestId('editor-draft').getByRole('link', { name: /Download recording/ })).toBeVisible()
  expect(state.saves).toHaveLength(0); expect(state.puts).toBe(0)
})

test('logout revocation blocks restoration when local draft removal fails', async ({ page, context }) => {
  await fixture(context); await page.goto('/request'); await page.locator('textarea').fill('Revoked draft'); await backup(page)
  await page.goto('/profile')
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem
    Storage.prototype.removeItem = function(k) { if (k.startsWith('tonebridge-compose-editor:')) throw new DOMException('fixture', 'SecurityError'); original.call(this, k) }
  })
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: /Log out/ }).click(); await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(k => localStorage.getItem(k), key)).not.toBeNull()
  await page.goto('/request'); await expect(page.locator('textarea')).toHaveValue('')
  await expect(page.getByTestId('editor-draft')).not.toContainText('Draft and settings restored')
})

test('successful submission clears its editor draft even when tombstone storage is full', async ({ page, context }) => {
  const state = await fixture(context); state.fail = false
  await compose(page, 'PERSONAL', 'TEXT', false); await backup(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(k, v) {
      if (k.startsWith('tonebridge-compose-editor:') && JSON.parse(v).value === null) throw new DOMException('fixture', 'QuotaExceededError')
      original.call(this, k, v)
    }
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/study\/saved-session\/cards\//)
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBeNull()
  await page.goto('/request'); await expect(page.locator('textarea')).toHaveValue('')
  expect(state.saves).toHaveLength(1)
})
