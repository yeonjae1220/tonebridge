import { expect, test, type BrowserContext, type Page } from '@playwright/test'

test.use({ locale: 'en-US' })
async function fixture(context: BrowserContext) {
  await context.addCookies([
    { name: 'session', value: 'fixture', domain: '127.0.0.1', path: '/' },
    { name: 'tonebridge_ui_language', value: 'en', domain: '127.0.0.1', path: '/' },
  ])
  const state = { puts: 0, saves: [] as { id: string; body: Record<string, unknown> }[], fail: true,
    lostResponse: false, failPut: false, completed: new Map<string, object>(), keys: [] as string[], cancelled: [] as string[] }
  await context.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path.startsWith('/api/auth/')) return route.fulfill({ json: { accessToken: 'owner' } })
    if (path === '/api/users/me') return route.fulfill({ json: { id: 'owner', username: 'Owner', uiLanguage: 'en', onboardingCompleted: true, nativeLanguage: 'ko', learningLanguages: ['en'], fluentLanguages: [] } })
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
async function reload(page: Page) {
  page.once('dialog', dialog => dialog.accept())
  await page.reload()
  page.removeAllListeners('dialog')
  await expect(page.getByRole('button', { name: 'Resume saving', exact: true })).toBeEnabled()
}
for (const destination of ['PERSONAL', 'FRIEND', 'COMMUNITY']) {
  for (const kind of ['TEXT', 'AUDIO']) {
    test(`${destination} ${kind}: resume after reload reuses completed upload and immutable input`, async ({ page, context }) => {
      const state = await fixture(context)
      await compose(page, destination, kind)
      await expect(page.locator('main').getByRole('alert')).toBeVisible()
      expect(state.saves).toHaveLength(1)
      const first = state.saves[0]
      await reload(page)
      await expect(page.locator('input')).toHaveValue('Keep this context')
      await expect(page.locator('input')).toBeDisabled()
      state.fail = false
      await page.getByRole('button', { name: 'Resume saving', exact: true }).click()
      await expect(page).toHaveURL(destination === 'COMMUNITY' ? /\/community$/ : /\/study\/saved-session\/cards\//)
      expect(state.saves).toEqual([first, first])
      expect(state.completed.size).toBe(1)
      expect(state.puts).toBe(kind === 'AUDIO' ? 1 : 0)
      expect(await page.evaluate(() => localStorage.getItem('tonebridge-composition:owner'))).toBeNull()
    })
  }
}
test('lost success response is resolved without another creation or upload', async ({ page, context }) => {
  const state = await fixture(context); state.lostResponse = true
  await compose(page, 'PERSONAL', 'AUDIO')
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  await reload(page)
  await page.getByRole('button', { name: 'Resume saving', exact: true }).click()
  await expect(page).toHaveURL(/\/study\/saved-session\/cards\//)
  expect(state.saves).toHaveLength(1); expect(state.puts).toBe(1)
})
test('failed upload retries the same reservation and creates nothing before PUT succeeds', async ({ page, context }) => {
  const state = await fixture(context); state.failPut = true
  await compose(page, 'FRIEND', 'AUDIO')
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  expect(state.saves).toHaveLength(0)
  await reload(page); state.failPut = false; state.fail = false
  await page.getByRole('button', { name: 'Resume saving', exact: true }).click()
  await expect(page).toHaveURL(/\/study\/saved-session\/cards\//)
  expect(state.keys).toHaveLength(2); expect(state.keys[1]).toBe(state.keys[0])
  expect(state.saves).toHaveLength(1)
})
test('edit checks the server and cancels the old identity before changing content', async ({ page, context }) => {
  const state = await fixture(context)
  await compose(page, 'PERSONAL', 'TEXT')
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  const old = state.saves[0].id
  await page.getByRole('button', { name: 'Check save status, then edit' }).click()
  await expect(page.locator('textarea')).toBeEnabled()
  expect(state.cancelled).toEqual([old])
  await page.locator('textarea').fill('Changed after checking')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  state.fail = false
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/study\/saved-session\/cards\//)
  expect(state.saves[1].id).not.toBe(old)
  expect(state.saves[1].body.contentText).toBe('Changed after checking')
})
test('editing an already saved entry opens the existing result', async ({ page, context }) => {
  const state = await fixture(context); state.lostResponse = true
  await compose(page, 'PERSONAL', 'TEXT')
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: 'Check save status, then edit' }).click()
  await expect(page).toHaveURL(/\/study\/saved-session\/cards\//)
  expect(state.saves).toHaveLength(1); expect(state.cancelled).toHaveLength(0)
})
test('blocked local storage never starts a nonrecoverable save', async ({ page, context }) => {
  const state = await fixture(context)
  await page.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.startsWith('tonebridge-composition:')) throw new DOMException('blocked', 'SecurityError'); original.call(this, key, value) } })
  await compose(page, 'PERSONAL', 'TEXT')
  await expect(page.locator('main').getByRole('alert')).toContainText('Saving has not started')
  expect(state.saves).toHaveLength(0); expect(state.puts).toBe(0)
})
test('two tabs cannot overwrite the pending identity or create a duplicate', async ({ page, context }) => {
  const state = await fixture(context)
  const second = await context.newPage()
  await compose(page, 'PERSONAL', 'TEXT', false)
  await compose(second, 'PERSONAL', 'TEXT', false)
  await Promise.all([page, second].map(tab => tab.getByRole('button', { name: 'Save', exact: true }).click()))
  await expect.poll(() => state.saves.length).toBe(1)
  await expect.poll(async () => (await page.locator('main').innerText()) + (await second.locator('main').innerText())).toContain('Another tab has an unconfirmed save')
  await reload(second); state.fail = false
  await second.getByRole('button', { name: 'Resume saving', exact: true }).click()
  await expect(second).toHaveURL(/\/study\/saved-session\/cards\//)
  expect(new Set(state.saves.map(save => save.id)).size).toBe(1)
  expect(state.completed.size).toBe(1)
})
