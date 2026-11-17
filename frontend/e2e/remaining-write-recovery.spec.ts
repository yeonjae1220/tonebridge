import { expect, test, type Page, type Route } from '@playwright/test'
import { fixture } from './fixtures/community'

async function cardApp(page: Page) {
  await fixture(page)
  const card = { id: 'card', sessionId: 'session-1', phrase: 'Practice phrase', note: 'Saved note', tags: [], createdByUserId: 'owner', createdAt: '2026-11-17T00:00:00Z' }
  const attempt = { id: 'attempt', cardId: 'card', learnerId: 'owner', correctionNote: 'Saved feedback', score: 3, audioUrl: null, attemptedAt: '2026-11-17T00:00:00Z' }
  const state = { card, attempt, holdWrite: false, holdRead: false, failRead: false, reads: 0, writes: 0, held: [] as Route[] }
  await page.route('**/api/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (!path.startsWith('/api/cards/card') && path !== '/api/attempts/attempt/correction') return route.fallback()
    if (req.method() === 'GET') {
      state.reads++
      if (state.holdRead) { state.held.push(route); return }
      if (state.failRead) return route.fulfill({ status: 503, json: {} })
      return route.fulfill({ json: path.endsWith('/attempts') ? [attempt] : path.endsWith('/native-audios') ? [] : card })
    }
    state.writes++
    if (state.holdWrite) { state.held.push(route); return }
    const value = path.endsWith('/correction') ? attempt : card
    Object.assign(value, req.postDataJSON())
    return route.fulfill({ json: value })
  })
  await page.goto('/study/session-1/cards/card')
  await expect(page.getByText('Practice phrase', { exact: true })).toBeVisible()
  return state
}
async function note(page: Page) {
  await page.locator('#card-note summary').click()
  const field = page.locator('#card-note textarea')
  await field.fill('Retained local note')
  return field
}
async function feedback(page: Page) {
  const item = page.locator('#attempt-attempt')
  await item.getByRole('button', { name: '피드백 수정', exact: true }).click()
  await item.getByRole('textbox').fill('Retained local feedback')
  return item
}
async function backgroundRefresh(page: Page) {
  await page.clock.fastForward(61_000)
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
}

test('card note timeout unlocks retained input and offers read-only recovery', async ({ page }) => {
  const state = await cardApp(page); state.holdWrite = true
  const field = await note(page); await page.clock.install()
  await page.locator('#card-note').getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.writes).toBe(1); await expect(field).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert')).toContainText('완료 여부')
  await expect(field).toBeEnabled(); await expect(field).toHaveValue('Retained local note')
  const reads = state.reads
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect.poll(() => state.reads).toBeGreaterThan(reads)
  await expect(field).toHaveValue('Retained local note'); expect(state.writes).toBe(1)
})

test('background card updates cannot overwrite an unsaved note', async ({ page }) => {
  const state = await cardApp(page), field = await note(page)
  await page.clock.install(); const reads = state.reads
  state.card.note = 'Other server note'; state.card.phrase = 'Updated server phrase'
  await backgroundRefresh(page); await expect.poll(() => state.reads).toBeGreaterThan(reads)
  await expect(page.getByText('Updated server phrase', { exact: true })).toBeVisible()
  await expect(field).toHaveValue('Retained local note')
})

test('feedback timeout retains score and text, unlocks and never resends automatically', async ({ page }) => {
  const state = await cardApp(page); state.holdWrite = true
  const item = await feedback(page); await item.getByRole('combobox').selectOption('5'); await page.clock.install()
  await item.getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.writes).toBe(1); await page.clock.fastForward(30_001)
  await expect(item.getByRole('alert')).toContainText('완료 여부')
  await expect(item.getByRole('textbox')).toBeEnabled(); await expect(item.getByRole('textbox')).toHaveValue('Retained local feedback')
  await expect(item.getByRole('combobox')).toHaveValue('5')
  await page.clock.fastForward(60_000); expect(state.writes).toBe(1)
})

test('confirmed feedback is visible and editable while follow-up reads stall', async ({ page }) => {
  const state = await cardApp(page), item = await feedback(page); state.holdRead = true
  await item.getByRole('button', { name: '저장', exact: true }).click()
  await expect(item.getByRole('textbox')).toHaveCount(0)
  await expect(item.getByText('Retained local feedback', { exact: true })).toBeVisible()
  await item.getByRole('button', { name: '피드백 수정', exact: true }).click()
  await expect(item.getByRole('textbox')).toHaveValue('Retained local feedback')
})

test('failed background reads preserve open feedback and note editors', async ({ page }) => {
  const state = await cardApp(page), field = await note(page), item = await feedback(page)
  await page.clock.install(); state.failRead = true
  await backgroundRefresh(page); await page.clock.fastForward(2_000)
  await expect(page.getByRole('main').getByRole('alert').first()).toBeVisible()
  await expect(field).toHaveValue('Retained local note')
  await expect(item.getByRole('textbox')).toHaveValue('Retained local feedback')
  state.failRead = false; await page.getByRole('button', { name: '다시 시도', exact: true }).first().click()
  await expect(field).toHaveValue('Retained local note')
})

async function mine(page: Page) {
  const base = await fixture(page)
  const state = { base, holdWrite: false, holdRead: false, writes: 0, reads: 0, held: [] as Route[] }
  await page.route('**/api/correction-requests/**', route => {
    if (route.request().method() === 'GET') {
      state.reads++
      if (state.holdRead) { state.held.push(route); return }
    } else {
      state.writes++
      if (state.holdWrite) { state.held.push(route); return }
    }
    return route.fallback()
  })
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/community'); await page.getByRole('button', { name: '내 요청', exact: true }).click()
  return state
}

test('community deletion timeout blocks duplicates then exposes read recovery', async ({ page }) => {
  const state = await mine(page); state.holdWrite = true; await page.clock.install()
  const remove = page.getByRole('button', { name: '삭제', exact: true })
  await remove.click(); await expect.poll(() => state.writes).toBe(1); await expect(remove).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert')).toContainText('완료 여부'); await expect(remove).toBeEnabled()
  const reads = state.reads; await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect.poll(() => state.reads).toBeGreaterThan(reads); expect(state.writes).toBe(1)
})

test('confirmed community deletion disappears even when list reads stall', async ({ page }) => {
  const state = await mine(page); state.holdRead = true
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('Original practice', { exact: true })).toHaveCount(0)
  expect(state.writes).toBe(1)
})

test('confirmed community edit appears even when list reads stall', async ({ page }) => {
  const state = await mine(page); state.holdRead = true
  await page.getByRole('button', { name: '수정', exact: true }).click()
  const dialog = page.getByRole('dialog'); await dialog.getByRole('textbox').first().fill('Confirmed edited request')
  await dialog.getByRole('button', { name: '저장', exact: true }).click(); await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Confirmed edited request', { exact: true })).toBeVisible()
})


for (const failure of ['timeout', 'unavailable'] as const) test(`review: transient refresh ${failure} retains the active note and permits explicit retry`, async ({ page }) => {
  const state = await cardApp(page), field = await note(page)
  let rejected = true, writes = 0, refreshes = 0
  await page.route('**/api/cards/card/note', route => {
    writes++
    if (route.request().headers().authorization !== 'Bearer restored-token') return route.fulfill({ status: 401, json: {} })
    return route.fallback()
  })
  await page.route('**/api/auth/refresh', route => {
    refreshes++
    if (rejected && failure === 'timeout') { state.held.push(route); return }
    return route.fulfill({ status: rejected ? 503 : 200, json: { accessToken: 'restored-token' } })
  })
  await page.clock.install()
  await page.locator('#card-note').getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => refreshes).toBe(1)
  if (failure === 'timeout') await page.clock.fastForward(15_001)
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/study\/session-1\/cards\/card$/)
  await expect(field).toHaveValue('Retained local note'); await expect(field).toBeEnabled()
  expect(writes).toBe(1)
  rejected = false
  await page.locator('#card-note').getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => writes).toBe(3)
  expect(refreshes).toBe(2); expect(state.writes).toBe(1)
  await expect(page.getByRole('status').filter({ hasText: /저장/ })).toBeVisible()
})

test('review: feedback filter changes preserve text and score', async ({ page }) => {
  await cardApp(page); const item = await feedback(page)
  await item.getByRole('combobox').selectOption('5')
  await page.getByRole('button', { name: '상대 연습', exact: true }).click()
  await expect(item).toHaveCount(0)
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await expect(item.getByRole('textbox')).toHaveValue('Retained local feedback')
  await expect(item.getByRole('combobox')).toHaveValue('5')
})

test('review: filtering a pending feedback save cannot unlock a duplicate submission', async ({ page }) => {
  const state = await cardApp(page); state.holdWrite = true
  const item = await feedback(page); await page.clock.install()
  await item.getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.writes).toBe(1)
  await page.getByRole('button', { name: '상대 연습', exact: true }).click()
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await expect(item.getByRole('textbox')).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(item.getByRole('alert')).toContainText('완료 여부')
  await expect(item.getByRole('textbox')).toHaveValue('Retained local feedback')
  await expect(item.getByRole('textbox')).toBeEnabled(); expect(state.writes).toBe(1)
})

test('review: a late note response does not revert a newer card phrase', async ({ page }) => {
  const state = await cardApp(page); await note(page)
  await page.clock.install(); await page.clock.fastForward(61_000)
  state.holdWrite = true
  const saved = { ...state.card, note: 'Retained local note' }
  await page.locator('#card-note').getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.writes).toBe(1)
  state.card.phrase = 'Newer card phrase'
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByText('Newer card phrase', { exact: true })).toBeVisible()
  state.holdRead = true
  await state.held[0].fulfill({ json: saved })
  await expect(page.locator('#card-note textarea')).toBeEnabled()
  await expect(page.getByText('Newer card phrase', { exact: true })).toBeVisible()
})

test('review: a late community edit cannot roll back the latest request status', async ({ page }) => {
  const state = await mine(page); state.holdWrite = true
  await page.clock.install(); await page.clock.fastForward(61_000)
  const saved = { ...state.base.request, contentText: 'Confirmed edited request' }
  await page.getByRole('button', { name: '수정', exact: true }).click()
  const dialog = page.getByRole('dialog'); await dialog.getByRole('textbox').first().fill(saved.contentText)
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.writes).toBe(1)
  state.base.request.status = 'IN_PROGRESS'
  const reads = state.reads
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect.poll(() => state.reads).toBeGreaterThan(reads)
  await expect(page.getByRole('button', { name: '수정', exact: true })).toHaveCount(0)
  state.holdRead = true
  await state.held[0].fulfill({ json: saved }); await expect(dialog).toHaveCount(0)
  await expect(page.getByText(saved.contentText, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '수정', exact: true })).toHaveCount(0)
})


test('review: failed writes never log the bearer token or submitted note', async ({ page }) => {
  await page.addInitScript(() => {
    const logs: string[] = []
    Object.assign(window, { reviewErrorLogs: logs })
    const original = console.error
    console.error = (...args) => { logs.push(JSON.stringify(args)); original(...args) }
  })
  await cardApp(page); await note(page)
  await page.route('**/api/cards/card/note', route => route.fulfill({ status: 503, json: {} }))
  await page.locator('#card-note').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  const logs = await page.evaluate(() => (window as Window & { reviewErrorLogs?: string[] }).reviewErrorLogs ?? [])
  expect(logs.some(line => line.includes('[mutation]'))).toBe(true)
  expect(logs.join('\n')).not.toContain('Bearer fixture')
  expect(logs.join('\n')).not.toContain('Retained local note')
})
