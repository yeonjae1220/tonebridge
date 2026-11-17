import { expect, test, type Page, type Route } from '@playwright/test'
import { fixture } from './fixtures/community'

async function setup(page: Page) {
  await fixture(page)
  const session = { id: 'session-1', title: 'Card recovery', createdBy: 'owner', memberIds: ['owner'], createdAt: '2026-11-17T00:00:00Z' }
  const cards = [0, 1].map(index => ({ id: 'card-' + index, sessionId: session.id, createdByUserId: 'owner', phrase: 'Phrase ' + index, context: '', tags: [], position: index, createdAt: session.createdAt }))
  const state = { cards, holdRead: false, holdWrite: false, reads: [] as Route[], writes: [] as Route[] }
  await page.route('**/api/sessions**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/sessions') return route.fulfill({ json: [session, { ...session, id: 'session-2', title: 'Target notebook' }] })
    if (path.endsWith('/cards')) {
      if (state.holdRead) { state.reads.push(route); return }
      return route.fulfill({ json: cards.filter(card => card.sessionId === path.split('/')[3]) })
    }
    return route.fulfill({ json: { ...session, id: path.split('/')[3] } })
  })
  await page.route('**/api/cards/**', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: cards[0] })
    state.writes.push(route)
    if (state.holdWrite) return
    const id = new URL(route.request().url()).pathname.split('/')[3]
    const card = cards.find(item => item.id === id)!
    return route.request().method() === 'DELETE' ? route.fulfill({ status: 204 }) : route.fulfill({ json: { ...card, ...route.request().postDataJSON(), sessionId: route.request().postDataJSON().targetSessionId ?? card.sessionId } })
  })
  await page.goto('/study')
  await page.getByRole('button', { name: /Card recovery/ }).first().click()
  await expect(page.getByText('Phrase 0', { exact: true })).toBeVisible()
  await page.locator('summary').first().click()
  return state
}
const cardRow = (page: Page, phrase: string) => page.locator('div[draggable]').filter({ has: page.getByText(phrase, { exact: true }) })

test('confirmed card edit is visible and reusable while reads stall', async ({ page }) => {
  const state = await setup(page); state.holdRead = true
  await cardRow(page, 'Phrase 0').getByRole('button', { name: '수정', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox').first().fill('Confirmed phrase')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Confirmed phrase', { exact: true })).toBeVisible()
  await cardRow(page, 'Confirmed phrase').getByRole('button', { name: '수정', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('textbox').first()).toHaveValue('Confirmed phrase')
})

test('pending card deletion blocks overlapping writes and confirmed deletion does not wait for reads', async ({ page }) => {
  const state = await setup(page); state.holdWrite = true; state.holdRead = true
  page.on('dialog', dialog => dialog.accept())
  const row = cardRow(page, 'Phrase 0')
  await row.getByRole('button', { name: '삭제', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  for (const name of ['삭제', '수정', '이동']) await expect(row.getByRole('button', { name, exact: true })).toBeDisabled()
  await expect(row).toHaveAttribute('draggable', 'false')
  await state.writes[0].fulfill({ status: 204 })
  await expect(page.getByText('Phrase 0', { exact: true })).toHaveCount(0)
  await cardRow(page, 'Phrase 1').locator('summary').click()
  await expect(cardRow(page, 'Phrase 1').getByRole('button', { name: '삭제', exact: true })).toBeEnabled()
})

test('confirmed reorder updates card positions without waiting for a list refresh', async ({ page }) => {
  const state = await setup(page); state.holdRead = true
  await cardRow(page, 'Phrase 0').getByRole('button', { name: '↓', exact: true }).click()
  await expect(page.locator('div[draggable]').first()).toContainText('Phrase 1')
  await expect(cardRow(page, 'Phrase 0').getByRole('button', { name: '↑', exact: true })).toBeEnabled()
})

test('confirmed move removes the source card while the source list refresh stalls', async ({ page }) => {
  const state = await setup(page); state.holdRead = true
  await cardRow(page, 'Phrase 0').getByRole('button', { name: '이동', exact: true }).click()
  await page.getByRole('dialog').getByRole('combobox').selectOption('session-2')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Phrase 0', { exact: true })).toHaveCount(0)
})

test('an old list response cannot resurrect a confirmed deletion', async ({ page }) => {
  const state = await setup(page); state.holdRead = true
  await page.clock.install(); await page.clock.fastForward(61_000)
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect.poll(() => state.reads.length).toBeGreaterThan(0)
  page.on('dialog', dialog => dialog.accept())
  await cardRow(page, 'Phrase 0').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('Phrase 0', { exact: true })).toHaveCount(0)
  await state.reads[0].fulfill({ json: state.cards }).catch(() => {})
  await expect(page.getByText('Phrase 0', { exact: true })).toHaveCount(0)
})


test('a confirmed move appears in an already cached target notebook', async ({ page }) => {
  const state = await setup(page)
  await page.goBack()
  await page.getByRole('button', { name: /Target notebook/ }).first().click()
  await expect(page).toHaveURL(/study\/session-2$/)
  await expect(page.locator('div[draggable]')).toHaveCount(0)
  await page.goBack()
  await page.getByRole('button', { name: /Card recovery/ }).first().click()
  await cardRow(page, 'Phrase 0').locator('summary').click()
  state.holdRead = true
  await cardRow(page, 'Phrase 0').getByRole('button', { name: '이동', exact: true }).click()
  await page.getByRole('dialog').getByRole('combobox').selectOption('session-2')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goBack()
  await page.getByRole('button', { name: /Target notebook/ }).first().click()
  await expect(page.getByText('Phrase 0', { exact: true })).toBeVisible()
})

test('an edit response from a closed screen cannot overwrite a newer confirmed edit', async ({ page }) => {
  const state = await setup(page); state.holdWrite = true
  await cardRow(page, 'Phrase 0').getByRole('button', { name: '수정', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox').first().fill('Old pending phrase')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await page.goBack()
  await page.getByRole('button', { name: /Card recovery/ }).first().click()
  await cardRow(page, 'Phrase 0').locator('summary').click()
  await cardRow(page, 'Phrase 0').getByRole('button', { name: '수정', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox').first().fill('Newest phrase')
  state.holdWrite = false; state.holdRead = true
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByText('Newest phrase', { exact: true })).toBeVisible()
  await state.writes[0].fulfill({ json: { ...state.cards[0], phrase: 'Old pending phrase' } })
  await expect(page.getByText('Newest phrase', { exact: true })).toBeVisible()
})
