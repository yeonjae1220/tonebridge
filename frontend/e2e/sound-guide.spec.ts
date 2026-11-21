import { expect, test, type Page } from '@playwright/test'
import { SOUND_GUIDES } from '../src/lib/soundGuides'
import serverGuideIds from '../src/lib/soundGuideIds.json'

const baseCard = {
  id: 'card-1', sessionId: 'session-1', createdByUserId: 'owner',
  phrase: 'I think the river is really long.', context: null, explanation: null, note: null,
  position: 0, createdAt: '2026-10-28T00:00:00Z', nativeAudioUrl: null,
}

const session = { id: 'session-1', title: '언어 교환', memberIds: ['owner', 'friend'], createdBy: 'owner', status: 'ACTIVE', createdAt: baseCard.createdAt }

async function mockApi(page: Page, tags: string[], uiLanguage = 'ko', listCard = false) {
  const state = { errors: [] as string[], created: [] as Record<string, unknown>[], updated: [] as Record<string, unknown>[] }
  page.on('pageerror', (error) => state.errors.push(error.message))
  // React key and hydration problems surface as console errors, not page errors.
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) state.errors.push(message.text()) })
  await page.context().addCookies([{ name: 'session', value: 'test-only', domain: '127.0.0.1', path: '/' }])
  await page.route('**/api/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') {
      if (path === '/api/sessions/session-1/cards') {
        state.created.push(request.postDataJSON() as Record<string, unknown>)
        return route.fulfill({ status: 201, json: { ...baseCard, tags } })
      }
      if (path === '/api/cards/card-1') {
        const body = request.postDataJSON() as Record<string, unknown>
        state.updated.push(body)
        return route.fulfill({ json: { ...baseCard, ...body } })
      }
      return route.fulfill({ json: { accessToken: 'test-only' } })
    }
    if (path === '/api/users/me') {
      return route.fulfill({ json: { id: 'owner', username: 'owner', onboardingCompleted: true, uiLanguage, credits: 0, nativeLanguage: 'ko', fluentLanguages: [], learningLanguages: ['en'] } })
    }
    if (path === '/api/cards/card-1') return route.fulfill({ json: { ...baseCard, tags } })
    if (path === '/api/sessions/session-1') return route.fulfill({ json: session })
    if (path === '/api/sessions/session-1/cards' && listCard) return route.fulfill({ json: [{ ...baseCard, tags }] })
    if (path === '/api/sessions') return route.fulfill({ json: [session] })
    return route.fulfill({ json: [] })
  })
  return state
}

async function openCard(page: Page, tags: string[], uiLanguage = 'ko') {
  const state = await mockApi(page, tags, uiLanguage)
  await page.goto('/study/session-1/cards/card-1')
  await expect(page.getByText(baseCard.phrase)).toBeVisible()
  return state
}

test('shows a mouth diagram for each tagged sound, with only the first one expanded', async ({ page }, testInfo) => {
  const state = await openCard(page, ['발음', '#TH', '/r/', '(l)', '\u1105'])

  const panel = page.getByRole('region', { name: '발음 가이드' })
  await expect(panel.locator('[data-sound-guide]')).toHaveCount(4)
  await expect(panel.getByText('베타', { exact: true })).toBeVisible()
  await expect(panel.getByText('그림과 설명은 아직 검수 중이에요. 참고용으로 봐 주세요.')).toBeVisible()
  await expect(panel.getByRole('img', { name: '영어 th — 입 안 옆모습' })).toBeVisible()
  await expect(panel.getByText('혀끝을 윗니와 아랫니 사이로 살짝 내밉니다.')).toBeVisible()
  await expect(panel.getByRole('img', { name: '영어 r — 입 안 옆모습' })).toBeHidden()

  await panel.getByText('영어 r', { exact: true }).click()
  await expect(panel.getByRole('img', { name: '영어 r — 입 안 옆모습' })).toBeVisible()
  await expect(panel.getByText('닿지 않고 가까이 가는 곳')).toBeVisible()

  const tonguePaths = await panel.locator('path[data-tongue]').evaluateAll((paths) => paths.map((path) => path.getAttribute('d') ?? ''))
  expect(tonguePaths.every((d) => d.length > 0 && !d.includes('NaN'))).toBe(true)
  expect(new Set(tonguePaths).size).toBe(4)
  await expect(panel.locator('circle.animate-ping')).toHaveCount(1)
  await expect(panel.locator('[data-sound-guide="ko-rieul"] circle.animate-ping')).toHaveCount(1)

  if (process.env.SOUND_GUIDE_SHOT_DIR) {
    await page.screenshot({ path: `${process.env.SOUND_GUIDE_SHOT_DIR}/card-${testInfo.project.name}.png`, fullPage: true })
  }
  expect(state.errors).toEqual([])
})

test('falls back to English guide text for UI languages without a translation', async ({ page }) => {
  await openCard(page, ['th'], 'fr')

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  const panel = page.getByRole('region', { name: 'Pronunciation guide' })
  await expect(panel.getByText('English th', { exact: true })).toBeVisible()
})

test('ordinary tags, including words that merely contain a sound name, show no guide', async ({ page }) => {
  await openCard(page, ['발음', '억양', 'rhythm', 'there', 'level'])

  await expect(page.getByText('발음', { exact: true })).toBeVisible()
  await expect(page.locator('[data-sound-guide]')).toHaveCount(0)
  await expect(page.getByRole('region', { name: '발음 가이드' })).toHaveCount(0)
})

test('sound buttons in the card form add and remove guide tags without touching typed tags', async ({ page }, testInfo) => {
  const state = await mockApi(page, [])
  await page.goto('/study/session-1')
  await page.getByRole('button', { name: '카드 추가', exact: true }).first().click()

  // Scoped by the form itself so the test does not depend on how the sheet around it is built.
  const dialog = page.locator('form').filter({ has: page.getByPlaceholder('쉼표로 구분') })
  await dialog.getByPlaceholder('쉼표로 구분').fill('발음')
  // The picker starts collapsed beside the tag input so the save button stays on screen.
  await dialog.getByRole('button', { name: '입 모양 그림 붙이기', exact: true }).click()
  const picker = dialog.getByRole('group', { name: '입 모양 그림 붙이기' })
  const th = picker.getByRole('button', { name: '영어 th', exact: true })
  const rieul = picker.getByRole('button', { name: '한국어 ㄹ', exact: true })

  await th.click()
  await rieul.click()
  await expect(th).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByPlaceholder('쉼표로 구분')).toHaveValue('발음, th, ㄹ')

  await th.click()
  await expect(th).toHaveAttribute('aria-pressed', 'false')
  await expect(dialog.getByPlaceholder('쉼표로 구분')).toHaveValue('발음, ㄹ')

  if (process.env.SOUND_GUIDE_SHOT_DIR) {
    await page.screenshot({ path: `${process.env.SOUND_GUIDE_SHOT_DIR}/form-${testInfo.project.name}.png` })
  }
  await dialog.getByRole('textbox').first().fill('우리 나라')
  // Submitted from the keyboard: this test is about the tags sent, not about where the save button sits.
  await dialog.getByPlaceholder('쉼표로 구분').press('Enter')
  await expect.poll(() => state.created).toEqual([{ phrase: '우리 나라', context: null, tags: ['발음', 'ㄹ'] }])
  expect(state.errors).toEqual([])
})

test('editing a card that already has a sound tag shows the buttons open and saves the changed tags', async ({ page }) => {
  const state = await mockApi(page, ['th'], 'ko', true)
  await page.goto('/study/session-1')
  await page.getByText('카드 관리', { exact: true }).click()
  await page.getByRole('button', { name: '수정', exact: true }).click()

  const form = page.locator('form').filter({ has: page.getByPlaceholder('쉼표로 구분') })
  const picker = form.getByRole('group', { name: '입 모양 그림 붙이기' })
  await expect(picker.getByRole('button', { name: '영어 th', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const toggle = form.getByRole('button', { name: '입 모양 그림 붙이기', exact: true })
  expect((await toggle.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

  await picker.getByRole('button', { name: '한국어 ㄹ', exact: true }).click()
  await expect(form.getByPlaceholder('쉼표로 구분')).toHaveValue('th, ㄹ')
  await form.getByPlaceholder('쉼표로 구분').press('Enter')
  await expect.poll(() => state.updated).toEqual([{ phrase: baseCard.phrase, context: null, tags: ['th', 'ㄹ'] }])
  expect(state.errors).toEqual([])
})

test('a restored draft with a sound tag reopens with the buttons showing', async ({ page }) => {
  const state = await mockApi(page, [])
  await page.goto('/study/session-1')
  const addCard = page.getByRole('button', { name: '카드 추가', exact: true }).first()
  const form = page.locator('form').filter({ has: page.getByPlaceholder('쉼표로 구분') })
  const picker = form.getByRole('group', { name: '입 모양 그림 붙이기' })

  await addCard.click()
  await expect(picker).toHaveCount(0)
  await form.getByRole('button', { name: '입 모양 그림 붙이기', exact: true }).click()
  await picker.getByRole('button', { name: '영어 th', exact: true }).click()
  await expect(form.getByText('임시 보관했습니다', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(form).toHaveCount(0)

  // The draft loads after the form mounts, so the picker cannot decide whether to open at mount time.
  await addCard.click()
  await expect(form.getByPlaceholder('쉼표로 구분')).toHaveValue('th')
  await expect(picker.getByRole('button', { name: '영어 th', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // Removing the last sound keeps the buttons in place instead of collapsing under the pointer.
  await picker.getByRole('button', { name: '영어 th', exact: true }).click()
  await expect(picker.getByRole('button', { name: '영어 th', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect(state.errors).toEqual([])
})

test('sound buttons leave the rest of the typed tag text exactly as written', async ({ page }) => {
  await mockApi(page, [])
  await page.goto('/study/session-1')
  await page.getByRole('button', { name: '카드 추가', exact: true }).first().click()
  const form = page.locator('form').filter({ has: page.getByPlaceholder('쉼표로 구분') })
  const tags = form.getByPlaceholder('쉼표로 구분')
  await form.getByRole('button', { name: '입 모양 그림 붙이기', exact: true }).click()
  const th = form.getByRole('button', { name: '영어 th', exact: true })

  // No space after the comma, and a comma still being typed at the end.
  await tags.fill('발음,억양,')
  await th.click()
  await expect(tags).toHaveValue('발음,억양, th')
  await th.click()
  await expect(tags).toHaveValue('발음,억양')

  // A sound tag typed by hand in the middle is removed without touching its neighbours.
  await tags.fill('발음,/TH/ ,억양')
  await expect(th).toHaveAttribute('aria-pressed', 'true')
  await th.click()
  await expect(tags).toHaveValue('발음,억양')
})

test('tags over the server limits are explained and cannot be saved, in both card forms', async ({ page }) => {
  const state = await mockApi(page, ['th'], 'ko', true)
  await page.goto('/study/session-1')
  const form = page.locator('form').filter({ has: page.getByPlaceholder('쉼표로 구분') })
  const tags = form.getByPlaceholder('쉼표로 구분')
  const save = form.getByRole('button', { name: '저장', exact: true })
  const limit = form.getByText('태그는 20개까지, 하나에 24자까지 쓸 수 있어요.')
  const twenty = Array.from({ length: 20 }, (_, index) => `t${index}`).join(',')

  await page.getByRole('button', { name: '카드 추가', exact: true }).first().click()
  await form.getByRole('textbox').first().fill('한도 확인')
  await tags.fill('가'.repeat(24))
  await expect(limit).toHaveCount(0)
  await expect(save).toBeEnabled()
  await tags.fill('가'.repeat(25))
  await expect(limit).toBeVisible()
  await expect(save).toBeDisabled()

  // At the count limit the sound buttons cannot add a 21st tag, and Enter does not submit past the limit.
  await tags.fill(twenty)
  await expect(limit).toHaveCount(0)
  await form.getByRole('button', { name: '입 모양 그림 붙이기', exact: true }).click()
  await expect(form.getByRole('button', { name: '영어 th', exact: true })).toBeDisabled()
  await tags.fill(`${twenty},하나더`)
  await expect(limit).toBeVisible()
  await tags.press('Enter')
  await expect(save).toBeDisabled()
  expect(state.created).toEqual([])
  await tags.fill('')
  await page.getByRole('button', { name: '닫기', exact: true }).click()

  await page.getByText('카드 관리', { exact: true }).click()
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await tags.fill('가'.repeat(25))
  await expect(limit).toBeVisible()
  await expect(save).toBeDisabled()
  await tags.press('Enter')
  expect(state.updated).toEqual([])
  expect(state.errors).toEqual([])
})

test('every guide the web renders is one the server accepts in feedback, and vice versa', () => {
  expect(SOUND_GUIDES.map((guide) => guide.id)).toEqual(serverGuideIds)
})
