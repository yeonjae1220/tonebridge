import { expect, test, type Page, type Route } from '@playwright/test'
import { fixture } from './fixtures/community'

async function app(page: Page) {
  await fixture(page)
  const session = { id: 'shared', title: 'Shared practice', createdBy: 'owner', memberIds: ['owner', 'friend'], createdAt: '2026-11-01T00:00:00Z' }
  const state = { stall: new Set<string>(), writes: [] as { path: string; body: Record<string, unknown> }[], held: [] as Route[], reads: 0 }
  await page.route('**/api/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    if (path.startsWith('/api/friends') || path.startsWith('/api/sessions')) {
      if (method === 'GET') state.reads++
      else state.writes.push({ path, body: req.postData() ? req.postDataJSON() : {} })
      if (state.stall.has(method + ' ' + path)) { state.held.push(route); return }
      if (path === '/api/friends') return route.fulfill({ json: [{ id: 'friend', username: 'Friend', nativeLanguage: 'en' }] })
      if (path === '/api/friends/pending') return route.fulfill({ json: ['one', 'two'].map(id => ({ id, senderId: id, senderUsername: 'Sender ' + id, createdAt: session.createdAt })) })
      if (path === '/api/friends/sent') return route.fulfill({ json: { items: [], nextPage: null } })
      if (path === '/api/sessions') return route.fulfill({ json: method === 'GET' ? [session] : { ...session, id: 'created' } })
      if (path.endsWith('/cards')) return route.fulfill({ json: [] })
      if (path.startsWith('/api/sessions/')) return route.fulfill({ json: session })
      return route.fulfill({ json: {} })
    }
    if (path === '/api/users/search') return route.fulfill({ json: [{ id: 'target', username: 'target', nativeLanguage: 'en' }] })
    return route.fallback()
  })
  return state
}

for (const screen of ['friends', 'study']) for (const action of ['accept', 'decline']) test(`${screen} ${action} times out visibly, blocks overlapping requests, and permits a read refresh`, async ({ page }) => {
  const state = await app(page)
  state.stall.add(action === 'accept' ? 'POST /api/friends/one/accept' : 'DELETE /api/friends/requests/one')
  await page.goto('/' + screen); await page.clock.install()
  await page.getByRole('button', { name: action === 'accept' ? '수락' : '거절', exact: true }).first().click()
  await expect.poll(() => state.writes.length).toBe(1)
  await expect(page.getByRole('button', { name: action === 'accept' ? '수락' : '거절', exact: true }).last()).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert').first()).toContainText('저장 완료 여부')
  await expect(page.getByRole('button', { name: action === 'accept' ? '수락' : '거절', exact: true }).first()).toBeEnabled()
  const reads = state.reads
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect.poll(() => state.reads).toBeGreaterThan(reads)
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1)
})

test('sending a friend request retains search input and recovers after a stalled write', async ({ page }) => {
  const state = await app(page); state.stall.add('POST /api/friends/request')
  await page.goto('/friends?invite=target')
  await expect(page.getByRole('button', { name: '요청', exact: true })).toBeVisible()
  await page.clock.install()
  await page.getByRole('button', { name: '요청', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert').first()).toContainText('저장 완료 여부')
  await expect(page.getByPlaceholder('닉네임으로 검색')).toHaveValue('target')
  await expect(page.getByRole('button', { name: '요청', exact: true })).toBeEnabled()
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1)
})

test('friend removal preserves the sharing choice and unlocks its dialog after timeout', async ({ page }) => {
  const state = await app(page); state.stall.add('DELETE /api/friends/friend')
  await page.goto('/friends'); await page.clock.install()
  await page.getByRole('button', { name: '친구 삭제', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: '친구 삭제', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await page.clock.fastForward(30_001)
  await expect(dialog.getByRole('alert')).toContainText('저장 완료 여부')
  await expect(dialog.getByRole('checkbox')).toBeChecked()
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1)
})

for (const stage of ['lookup', 'create']) test(`starting practice bounds the entire ${stage} phase without a late create or redirect`, async ({ page }) => {
  const state = await app(page)
  if (stage === 'create') await page.route('**/api/sessions', route => route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback())
  state.stall.add((stage === 'lookup' ? 'GET' : 'POST') + ' /api/sessions')
  await page.goto('/friends'); await page.clock.install()
  await page.getByRole('button', { name: '카드 열기', exact: true }).click()
  await expect.poll(() => state.held.length).toBe(1)
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert').first()).toContainText('저장 완료 여부')
  await expect(page.getByRole('button', { name: '카드 열기', exact: true })).toBeEnabled()
  await state.held[0].fulfill({ json: stage === 'lookup' ? [] : { id: 'late' } }).catch(() => {})
  await page.clock.fastForward(60_000)
  expect(state.writes).toHaveLength(stage === 'lookup' ? 0 : 1)
  await expect(page).toHaveURL(/friends$/)
})

for (const action of ['create', 'rename', 'delete']) test(`practice ${action} keeps input and shows unknown outcome after timeout`, async ({ page }) => {
  const state = await app(page)
  state.stall.add(action === 'create' ? 'POST /api/sessions' : (action === 'rename' ? 'PATCH' : 'DELETE') + ' /api/sessions/shared')
  page.on('dialog', prompt => prompt.accept())
  await page.goto('/study'); await page.clock.install()
  if (action === 'create') {
    await page.getByRole('button', { name: '친구와 시작하기', exact: true }).click()
    await page.getByRole('dialog').getByRole('combobox').selectOption('friend')
    await page.getByRole('dialog').getByRole('textbox').fill('Keep the new title')
    await page.getByRole('dialog').getByRole('button', { name: '시작하기', exact: true }).click()
  } else {
    await page.locator('details').locator('summary').click()
    await page.getByRole('button', { name: action === 'rename' ? '수정' : '삭제', exact: true }).click()
    if (action === 'rename') {
      await page.getByRole('dialog').getByRole('textbox').fill('Keep the edited title')
      await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
    }
  }
  await expect.poll(() => state.writes.length).toBe(1)
  if (action !== 'delete') await expect(page.getByRole('dialog').getByRole('textbox')).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert').first()).toContainText('저장 완료 여부')
  if (action !== 'delete') {
    await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue(action === 'create' ? 'Keep the new title' : 'Keep the edited title')
    await expect(page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true })).toBeEnabled()
    await page.keyboard.press('Escape')
  }
  const reads = state.reads
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect.poll(() => state.reads).toBeGreaterThan(reads)
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1)
})

for (const source of ['friends', 'study']) test(`a delayed ${source} practice creation does not redirect a newer screen`, async ({ page }) => {
  const state = await app(page); state.stall.add('POST /api/sessions')
  await page.route('**/api/sessions', route => route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback())
  await page.goto('/friends')
  if (source === 'friends') await page.getByRole('button', { name: '카드 열기', exact: true }).click()
  else {
    await page.locator('nav').getByRole('link', { name: '스터디', exact: true }).click()
    await page.getByRole('button', { name: '친구와 시작하기', exact: true }).click()
    await page.getByRole('dialog').getByRole('combobox').selectOption('friend')
    await page.getByRole('dialog').getByRole('button', { name: '시작하기', exact: true }).click()
  }
  await expect.poll(() => state.held.length).toBe(1)
  if (source === 'friends') await page.locator('nav').getByRole('link', { name: '스터디', exact: true }).click()
  else await page.goBack()
  await expect(page).toHaveURL(source === 'friends' ? /study$/ : /friends$/)
  const response = page.waitForResponse('**/api/sessions')
  await state.held[0].fulfill({ json: { id: 'created' } }); await response
  const redirected = await page.waitForURL(/study\/created$/, { timeout: 1000 }).then(() => true, () => false)
  expect(redirected).toBe(false)
  expect(state.writes).toHaveLength(1)
})

for (const scenario of ['friends-decline', 'study-decline', 'study-rename', 'study-delete']) test(`successful ${scenario} is not kept pending by a stalled follow-up read`, async ({ page }) => {
  const state = await app(page)
  const decline = scenario.endsWith('decline'), rename = scenario.endsWith('rename')
  const path = decline ? '/api/friends/requests/one' : '/api/sessions/shared'
  await page.route('**' + path, route => {
    state.stall.add('GET ' + (decline ? '/api/friends/pending' : '/api/sessions'))
    return route.fallback()
  })
  await page.goto(scenario.startsWith('friends') ? '/friends' : '/study'); await page.clock.install()
  page.on('dialog', prompt => prompt.accept())
  if (decline) await page.getByRole('button', { name: '거절', exact: true }).first().click()
  else {
    await page.locator('details').locator('summary').click()
    await page.getByRole('button', { name: rename ? '수정' : '삭제', exact: true }).click()
    if (rename) {
      await page.getByRole('dialog').getByRole('textbox').fill('Successfully updated title')
      await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
    }
  }
  await expect.poll(() => state.held.length).toBeGreaterThan(0)
  if (rename) await expect(page.getByRole('dialog')).toHaveCount(0)
  else if (decline) await expect(page.getByRole('button', { name: '거절', exact: true }).first()).toBeEnabled()
  else await expect(page.getByRole('button', { name: '삭제', exact: true })).toHaveCount(0)
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
  expect(state.writes).toHaveLength(1)
})

for (const screen of ['friends', 'study']) for (const action of ['accept', 'decline']) test(`confirmed ${screen} ${action} removes the handled request while refresh stalls`, async ({ page }) => {
  const state = await app(page)
  const endpoint = action === 'accept' ? '/api/friends/one/accept' : '/api/friends/requests/one'
  await page.route('**' + endpoint, route => { state.stall.add('GET /api/friends/pending'); return route.fallback() })
  await page.goto('/' + screen)
  await page.getByRole('button', { name: action === 'accept' ? '수락' : '거절', exact: true }).first().click()
  await expect.poll(() => state.held.length).toBeGreaterThan(0)
  await expect(page.getByText('Sender one', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Sender two', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '거절', exact: true })).toBeEnabled()
  expect(state.writes).toHaveLength(1)
})

test('confirmed friend removal disappears while the friends refresh stalls', async ({ page }) => {
  const state = await app(page)
  await page.route('**/api/friends/friend**', route => { state.stall.add('GET /api/friends'); return route.fallback() })
  await page.goto('/friends')
  await page.getByRole('button', { name: '친구 삭제', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '친구 삭제', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => state.held.length).toBeGreaterThan(0)
  await expect(page.getByText('Friend', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '친구 삭제', exact: true })).toHaveCount(0)
})

for (const action of ['rename', 'delete']) test(`confirmed practice ${action} updates the visible list before a stalled refresh`, async ({ page }) => {
  const state = await app(page)
  await page.route('**/api/sessions/shared', route => { state.stall.add('GET /api/sessions'); return route.fallback() })
  page.on('dialog', prompt => prompt.accept())
  await page.goto('/study')
  await page.locator('details').locator('summary').click()
  await page.getByRole('button', { name: action === 'rename' ? '수정' : '삭제', exact: true }).click()
  if (action === 'rename') {
    await page.getByRole('dialog').getByRole('textbox').fill('Confirmed title')
    await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  await expect.poll(() => state.held.length).toBeGreaterThan(0)
  await expect(page.getByText('Shared practice', { exact: true })).toHaveCount(0)
  if (action === 'rename') {
    await expect(page.getByText('Confirmed title', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: '수정', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('Confirmed title')
  }
})

test('confirmed sent request remains visible and cannot be sent again while refresh stalls', async ({ page }) => {
  const state = await app(page)
  await page.route('**/api/friends/request', route => {
    state.stall.add('GET /api/friends/sent')
    return route.fulfill({ json: { id: 'sent-one', senderId: 'owner', receiverId: 'target', createdAt: '2026-11-16T00:00:00Z' } })
  })
  await page.goto('/friends?invite=target')
  await page.getByRole('button', { name: '요청', exact: true }).click()
  await expect.poll(() => state.held.length).toBeGreaterThan(0)
  await expect(page.getByRole('region', { name: '보낸 친구 요청', exact: true }).getByText('target', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '친구 추가', exact: true }).click()
  await page.getByPlaceholder('닉네임으로 검색').fill('target')
  await expect(page.getByRole('button', { name: '요청', exact: true })).toHaveCount(0)
})

test('a new practice action shows its own failure instead of an older operation error', async ({ page }) => {
  await app(page)
  await page.route('**/api/sessions/shared', route => route.fulfill({ status: 503, json: { message: 'Previous delete failed' } }))
  let failAccept = true
  await page.route('**/api/friends/one/accept', route => failAccept ? route.fulfill({ status: 503, json: { message: 'Current accept failed' } }) : route.fallback())
  page.on('dialog', prompt => prompt.accept())
  await page.goto('/study')
  await page.locator('details').locator('summary').click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Previous delete failed')
  await page.getByRole('button', { name: '수락', exact: true }).first().click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Current accept failed')
  await expect(page.getByText('Previous delete failed', { exact: true })).toHaveCount(0)
  failAccept = false
  await page.getByRole('button', { name: '수락', exact: true }).first().click()
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
})


test('a stale refresh started before rename cannot restore the previous title', async ({ page }) => {
  const state = await app(page)
  await page.goto('/study')
  await page.locator('details').locator('summary').click()
  state.stall.add('GET /api/sessions')
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect.poll(() => state.held.length).toBe(1)
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('Confirmed after old read')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => state.held.length).toBe(2)
  await expect(page.getByText('Confirmed after old read', { exact: true }).first()).toBeVisible()
  await state.held[0].fulfill({ json: [{ id: 'shared', title: 'Shared practice', createdBy: 'owner', memberIds: ['owner', 'friend'], createdAt: '2026-11-01T00:00:00Z' }] }).catch(() => {})
  const reverted = await page.getByRole('button', { name: 'Shared practice', exact: true }).waitFor({ state: 'visible', timeout: 1000 }).then(() => true, () => false)
  expect(reverted).toBe(false)
})


test('an older delayed failure cannot replace the newest practice action error', async ({ page }) => {
  const state = await app(page); state.stall.add('DELETE /api/sessions/shared')
  await page.route('**/api/friends/one/accept', route => route.fulfill({ status: 503, json: { message: 'Current accept failed' } }))
  page.on('dialog', prompt => prompt.accept())
  await page.goto('/study')
  await page.locator('details').locator('summary').click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect.poll(() => state.held.length).toBe(1)
  await page.getByRole('button', { name: '수락', exact: true }).first().click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Current accept failed')
  await state.held[0].fulfill({ status: 503, json: { message: 'Older delete failed' } })
  await expect(page.getByRole('button', { name: '삭제', exact: true })).toBeEnabled()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Current accept failed')
  await expect(page.getByText('Older delete failed', { exact: true })).toHaveCount(0)
})
