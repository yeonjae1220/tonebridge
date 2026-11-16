import { expect, test, type Page } from '@playwright/test'
import { fixture } from './fixtures/community'

async function study(page: Page) {
  const base = await fixture(page)
  const session = { id: 'session-1', title: 'Practice', createdBy: 'owner', memberIds: ['owner', 'friend'], createdAt: '2026-11-01T00:00:00Z' }
  const card = { id: 'card-1', sessionId: session.id, createdByUserId: 'owner', phrase: 'Existing phrase', context: '', tags: [], position: 0, createdAt: session.createdAt }
  const state = { failSessions: false, writes: [] as { key?: string; body: Record<string, unknown> }[] }
  await page.route('**/api/sessions**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/sessions') return state.failSessions ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: [session, { ...session, id: 'session-2', title: 'Other practice' }] })
    if (path.endsWith('/cards')) {
      if (route.request().method() === 'POST') {
        state.writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
        return route.fulfill({ status: 201, json: { ...card, id: 'new-card' } })
      }
      return route.fulfill({ json: [card] })
    }
    return route.fulfill({ json: { ...session, id: path.split('/').at(-1) } })
  })
  return { ...state, base, setFailed: (value: boolean) => { state.failSessions = value }, writes: state.writes }
}

async function openCreate(page: Page) {
  await page.goto('/study/session-1')
  await page.getByRole('button', { name: '카드 추가', exact: true }).click()
}

test('direct card input restores through draft management, preserving unfinished tags and session scope', async ({ page }) => {
  await study(page)
  await openCreate(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '표현', exact: true }).fill('Direct card draft')
  await dialog.getByRole('textbox').last().fill('greeting, grammar, ')
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('tonebridge-recovery:') && localStorage.getItem(k)?.includes('greeting, grammar, ')))).toBe(true)
  await page.reload()
  await page.getByRole('button', { name: '카드 추가', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: '표현', exact: true })).toHaveValue('Direct card draft')
  await expect(dialog.getByRole('textbox').last()).toHaveValue('greeting, grammar, ')
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await page.goto('/study/session-2')
  await page.getByRole('button', { name: '카드 추가', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: '표현', exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await page.goto('/drafts')
  await page.getByTestId('managed-feedback').getByRole('link').click()
  await expect(page).toHaveURL(/study\/session-1\?create=1$/)
  await expect(dialog.getByRole('textbox', { name: '표현', exact: true })).toHaveValue('Direct card draft')
})

test('direct card response loss retries the same durable submission after reload', async ({ page }) => {
  await study(page)
  const posts: { key?: string; body: unknown }[] = []
  await page.route('**/api/sessions/session-1/cards', route => {
    if (route.request().method() !== 'POST') return route.fallback()
    posts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
    return posts.length === 1 ? route.abort('failed') : route.fulfill({ status: 201, json: { id: 'once', sessionId: 'session-1' } })
  })
  await openCreate(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '표현', exact: true }).fill('Create this card once')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('저장 완료 여부')
  expect(posts[0].key).toMatch(/^[0-9a-f-]{36}$/)
  await page.reload()
  await page.getByRole('button', { name: '카드 추가', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: '표현', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0])
  await expect(page.getByRole('link', { name: /카드 열기/ })).toHaveAttribute('href', '/study/session-1/cards/once')
})

for (const action of ['edit', 'move', 'leave']) test(`stalled session ${action} unlocks with an uncertain-result message and no auto retry`, async ({ page }) => {
  await study(page); await page.clock.install()
  let writes = 0
  await page.route(action === 'leave' ? '**/api/sessions/session-1/membership' : action === 'move' ? '**/api/cards/card-1/move' : '**/api/cards/card-1', () => { writes++ })
  await page.goto('/study/session-1')
  if (action !== 'leave') await page.locator('details').last().locator('summary').click()
  await page.getByRole('button', { name: action === 'edit' ? '수정' : action === 'move' ? '이동' : '연습장 나가기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  if (action === 'edit') await dialog.getByRole('textbox', { name: '표현', exact: true }).fill('Keep the edited phrase')
  await dialog.getByRole('button', { name: action === 'leave' ? '연습장 나가기' : '저장', exact: true }).click()
  await expect.poll(() => writes).toBe(1)
  await page.clock.fastForward(30_001)
  await expect(dialog.getByRole('alert')).toContainText('저장 완료 여부')
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeEnabled()
  if (action === 'edit') await expect(dialog.getByRole('textbox', { name: '표현', exact: true })).toHaveValue('Keep the edited phrase')
  await page.clock.fastForward(60_000); expect(writes).toBe(1)
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
})

test('failed move-target loading offers retry and prevents moving with incomplete choices', async ({ page }) => {
  const state = await study(page); state.setFailed(true)
  await page.goto('/study/session-1')
  await page.locator('details').last().locator('summary').click()
  await page.getByRole('button', { name: '이동', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeDisabled()
  state.setFailed(false)
  await dialog.getByRole('button', { name: /다시|재시도/ }).click()
  await expect(dialog.getByRole('combobox').locator('option')).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeEnabled()
})


test('direct card storage failure preserves input and prevents a submission without an identity', async ({ page }) => {
  const state = await study(page)
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('tonebridge-recovery:')) throw new DOMException('full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await openCreate(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '표현', exact: true }).fill('Keep this unsaved direct card')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('textbox', { name: '표현', exact: true })).toHaveValue('Keep this unsaved direct card')
  expect(state.writes).toHaveLength(0)
})

test('direct card editing resolves an uncertain save before changing the submission identity', async ({ page }) => {
  await study(page)
  const keys: string[] = []; let cancelled = ''
  await page.route('**/api/sessions/session-1/cards', route => {
    if (route.request().method() !== 'POST') return route.fallback()
    keys.push(route.request().headers()['idempotency-key'])
    return keys.length === 1 ? route.abort('failed') : route.fulfill({ status: 201, json: { id: 'revised', sessionId: 'session-1' } })
  })
  await page.route('**/api/submissions/*/cancel', route => {
    cancelled = new URL(route.request().url()).pathname.split('/')[3]
    return route.fulfill({ json: { type: 'cancelled' } })
  })
  await openCreate(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '표현', exact: true }).fill('Original direct card')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('button', { name: '저장 결과 확인 후 수정', exact: true }).click()
  await expect.poll(() => cancelled).toBe(keys[0])
  await dialog.getByRole('textbox', { name: '표현', exact: true }).fill('Revised direct card')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(keys).toHaveLength(2); expect(keys[1]).not.toBe(keys[0])
})

test('direct card drafts are removed on logout and cannot cross accounts', async ({ page }) => {
  const state = await study(page)
  await openCreate(page)
  await page.getByRole('dialog').getByRole('textbox', { name: '표현', exact: true }).fill('Private direct card')
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('tonebridge-recovery:owner:') && localStorage.getItem(k)?.includes('Private direct card')))).toBe(true)
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  await page.goto('/profile/settings')
  await page.getByRole('button', { name: /^로그아웃/ }).click()
  await expect(page).toHaveURL(/login$/)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('tonebridge-recovery:owner:')))).toEqual([])
  state.base.viewer = 'another-user'
  await page.getByLabel('이메일', { exact: true }).fill('other@example.test')
  await page.getByLabel('비밀번호', { exact: true }).fill('Fixture1!')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/study$/)
  await openCreate(page)
  await expect(page.getByRole('dialog').getByRole('textbox', { name: '표현', exact: true })).toHaveValue('')
})


test('direct card account lookup failure offers retry instead of a permanently disabled form', async ({ page }) => {
  await study(page)
  let fail = true
  await page.route('**/api/users/me', route => fail ? route.fulfill({ status: 503, json: {} }) : route.fallback())
  await openCreate(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeDisabled()
  fail = false
  await dialog.getByRole('button', { name: /다시|재시도/ }).click()
  await dialog.getByRole('textbox', { name: '표현', exact: true }).fill('Recovered account lookup')
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeEnabled()
})

for (const pending of [false, true]) test(`initial card storage read failure retries without replacing a ${pending ? 'pending submission' : 'saved draft'}`, async ({ page }) => {
  await study(page)
  const keys: string[] = []
  await page.route('**/api/sessions/session-1/cards', route => {
    if (route.request().method() !== 'POST') return route.fallback()
    keys.push(route.request().headers()['idempotency-key'])
    return keys.length === 1 && pending ? route.abort('failed') : route.fulfill({ status: 201, json: { id: 'recovered-card', sessionId: 'session-1' } })
  })
  await openCreate(page)
  const dialog = page.getByRole('dialog')
  const phrase = dialog.getByRole('textbox', { name: '표현', exact: true })
  await phrase.fill('Existing input must survive a failed read')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tonebridge-recovery:owner:card-new:session-1')?.includes('Existing input'))).toBe(true)
  if (pending) {
    await dialog.getByRole('button', { name: '저장', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
  }
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await page.evaluate(() => {
    const get = Storage.prototype.getItem
    Object.assign(window, { blockRecoveryRead: true })
    Storage.prototype.getItem = function(key) {
      if (key.startsWith('tonebridge-recovery:') && (window as unknown as { blockRecoveryRead: boolean }).blockRecoveryRead) throw new DOMException('blocked', 'SecurityError')
      return get.call(this, key)
    }
  })
  await page.getByRole('button', { name: '카드 추가', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(phrase).toBeDisabled()
  await page.evaluate(() => Object.assign(window, { blockRecoveryRead: false }))
  await dialog.getByRole('button', { name: /재시도/ }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(phrase).toHaveValue('Existing input must survive a failed read')
  if (pending) await expect(phrase).toBeDisabled()
  else await expect(phrase).toBeEnabled()
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(keys).toHaveLength(pending ? 2 : 1)
  if (pending) expect(keys[1]).toBe(keys[0])
})

test('closing direct card creation during a blocked autosave preserves the latest input when cancelled', async ({ page }) => {
  await study(page); await page.clock.install(); await openCreate(page)
  const dialog = page.getByRole('dialog')
  const phrase = dialog.getByRole('textbox', { name: '표현', exact: true })
  await phrase.fill('Previous durable input')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tonebridge-recovery:owner:card-new:session-1')?.includes('Previous durable'))).toBe(true)
  await page.evaluate(async () => {
    await new Promise<void>(resolve => { void navigator.locks.request('tonebridge-recovery:owner:card-new:session-1', () => new Promise<void>(release => { Object.assign(window, { releaseReviewLock: release }); resolve() })) })
  })
  await phrase.fill('Latest input while another tab holds the lock')
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).pending?.length ?? 0)).toBeGreaterThan(0)
  let confirmations = 0
  page.on('dialog', async prompt => { confirmations++; await prompt.dismiss() })
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  expect(confirmations).toBe(1)
  await expect(phrase).toHaveValue('Latest input while another tab holds the lock')
  await page.clock.fastForward(5001)
  await expect(dialog.getByRole('alert')).toBeVisible()
  await page.evaluate(() => (window as unknown as { releaseReviewLock: () => void }).releaseReviewLock())
  await dialog.getByRole('button', { name: /재시도/ }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tonebridge-recovery:owner:card-new:session-1')?.includes('Latest input'))).toBe(true)
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(dialog).toHaveCount(0); expect(confirmations).toBe(1)
  await page.getByRole('button', { name: '카드 추가', exact: true }).click()
  await expect(phrase).toHaveValue('Latest input while another tab holds the lock')
})


test('a delayed leave response cannot redirect away from a different practice editor', async ({ page }) => {
  await study(page)
  let finish: (() => Promise<void>) | undefined
  await page.route('**/api/sessions/session-1/membership', route => { finish = () => route.fulfill({ status: 204 }) })
  await page.goto('/study')
  await page.getByRole('button', { name: 'Practice', exact: true }).click()
  await page.getByRole('button', { name: '연습장 나가기', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '연습장 나가기', exact: true }).click()
  await expect.poll(() => !!finish).toBe(true)
  await page.goBack()
  await expect(page).toHaveURL(/study$/)
  await page.getByRole('button', { name: 'Other practice', exact: true }).click()
  await page.getByRole('button', { name: '카드 추가', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: '표현', exact: true }).fill('Keep editing the second practice')
  const response = page.waitForResponse('**/api/sessions/session-1/membership')
  await finish!(); await response
  // Keep observing after the response; an immediate URL assertion can miss the stale callback.
  const redirected = await page.waitForURL(/study$/, { timeout: 1000 }).then(() => true, () => false)
  expect(redirected).toBe(false)
  await expect(page).toHaveURL(/study\/session-2$/)
  await expect(page.getByRole('dialog').getByRole('textbox', { name: '표현', exact: true })).toHaveValue('Keep editing the second practice')
})
