import { expect, test, type Page } from '@playwright/test'

const browserErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(browserErrors.get(page), 'No unhandled browser errors').toEqual([])
})

const card = {
  id: 'card-1', sessionId: 'session-1', createdByUserId: 'owner',
  phrase: 'こんにちは', context: null, explanation: null, tags: [], note: null,
  position: 0, createdAt: '2026-10-28T00:00:00Z', nativeAudioUrl: null,
}
const attempt = {
  id: 'attempt-1', cardId: card.id, learnerId: 'owner', audioUrl: 'practice.webm',
  correctionNote: null as string | null, score: null as number | null,
  attemptedAt: '2026-10-28T00:00:00Z',
}

async function mockStudy(page: Page, userId = 'owner') {
  await page.context().addCookies([{ name: 'session', value: 'test-only', domain: '127.0.0.1', path: '/' }])
  const state = {
    attempts: [{ ...attempt }],
    submitted: [] as { path: string; body: Record<string, unknown> }[],
    failPractice: false,
    scores: false,
  }
  const session = { id: 'session-1', title: '언어 교환', memberIds: ['owner', 'friend'], createdBy: 'owner', status: 'ACTIVE', createdAt: card.createdAt }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') {
      const body = request.postDataJSON() as Record<string, unknown> | null
      state.submitted.push({ path, body: body ?? {} })
      if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: 'test-only' } })
      if (path.endsWith('/presigned-upload') || path.endsWith('/upload-url')) {
        return route.fulfill({ json: { uploadUrl: 'http://127.0.0.1:3100/test-audio-upload', audioKey: 'recording.webm' } })
      }
      if (path.endsWith('/attempts')) {
        if (state.failPractice) return route.fulfill({ status: 503, json: { message: 'Retry later' } })
        state.attempts.push({ ...attempt, id: 'attempt-2', learnerId: userId })
        return route.fulfill({ status: 201, json: state.attempts.at(-1) })
      }
      if (path.endsWith('/correction')) {
        state.attempts[0] = { ...state.attempts[0], ...body }
        return route.fulfill({ json: state.attempts[0] })
      }
      return route.fulfill({ status: 201, json: {} })
    }
    if (path === '/api/users/me') return route.fulfill({ json: { id: userId, username: userId, uiLanguage: 'ko', credits: 30, nativeLanguage: 'ko', fluentLanguages: [], learningLanguages: ['ja'] } })
    if (path === '/api/cards/card-1') return route.fulfill({ json: card })
    if (path.endsWith('/attempts')) return route.fulfill({ json: state.attempts })
    if (path === '/api/sessions/session-1') return route.fulfill({ json: session })
    if (path === '/api/sessions') return route.fulfill({ json: [session] })
    if (path === '/api/sessions/session-1/cards') {
      const cards = state.scores
        ? [5, 4, 3, 2, 1, null].map((score, index) => ({ ...card, id: `card-${index}`, latestAttempt: { ...attempt, score } }))
        : [{ ...card, latestAttempt: state.attempts[0] }]
      return route.fulfill({ json: cards })
    }
    return route.fulfill({ json: [] })
  })
  await page.route('**/test-audio-upload', (route) => route.fulfill({ status: 200, body: '' }))
  return state
}

async function recordAudio(page: Page) {
  await page.locator('#recording-panel').getByRole('button', { name: '녹음 시작', exact: true }).click()
  await page.getByRole('button', { name: '녹음 시작', exact: true }).last().click()
  await expect(page.getByRole('button', { name: '녹음 중지', exact: true })).toBeVisible()
  // Let the browser's fake microphone emit an audio chunk (MediaRecorder uses 100 ms slices).
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '녹음 중지', exact: true }).click()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveAttribute('src', /^blob:/)
  await expect.poll(() => page.locator('#recording-panel audio').evaluate((audio: HTMLAudioElement) => audio.readyState)).toBeGreaterThan(0)
}

for (const user of ['owner', 'friend']) {
  test(`${user} can save practice and then add an example`, async ({ page }) => {
    const state = await mockStudy(page, user)
    await page.goto('/study/session-1/cards/card-1')
    const practice = page.getByRole('button', { name: '내 발음 연습', exact: true })
    const example = page.getByRole('button', { name: '예시 발음 추가', exact: true })
    await expect(practice).toHaveAttribute('aria-pressed', 'true')

    await recordAudio(page)
    await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
    await expect(page.locator('#recording-panel audio')).toHaveCount(0)
    expect(state.submitted.filter((r) => r.path === '/api/cards/card-1/attempts')).toEqual([
      { path: '/api/cards/card-1/attempts', body: { audioKey: 'recording.webm' } },
    ])

    await example.click()
    await expect(example).toHaveAttribute('aria-pressed', 'true')
    await recordAudio(page)
    await page.getByRole('button', { name: '예시 발음 저장', exact: true }).click()
    await expect(page.locator('#recording-panel audio')).toHaveCount(0)
    expect(state.submitted.some((r) => r.path === '/api/cards/card-1/native-audios')).toBe(true)
  })
}

test('failed practice submission keeps the recording for retry', async ({ page }) => {
  const state = await mockStudy(page)
  state.failPractice = true
  await page.goto('/study/session-1/cards/card-1')
  await recordAudio(page)
  const blobUrl = await page.locator('#recording-panel audio').getAttribute('src')
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect(page.getByText('녹음을 제출하지 못했습니다. 다시 시도해주세요.')).toBeVisible()
  await expect(page.locator('#recording-panel audio')).toHaveAttribute('src', blobUrl!)
  state.failPractice = false
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
})

test('microphone permission wait locks the recorder and its purpose', async ({ page }) => {
  await mockStudy(page)
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise((_resolve, reject) => {
      window.addEventListener('test:deny-microphone', () => reject(new DOMException('Denied', 'NotAllowedError')), { once: true })
    })
  })
  await page.goto('/study/session-1/cards/card-1')
  await page.locator('#recording-panel').getByRole('button', { name: '녹음 시작', exact: true }).click()
  await page.getByRole('button', { name: '녹음 시작', exact: true }).last().click()
  await expect(page.getByRole('button', { name: '닫기', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '예시 발음 추가', exact: true })).toBeDisabled()
  await page.evaluate(() => window.dispatchEvent(new Event('test:deny-microphone')))
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByRole('button', { name: '예시 발음 추가', exact: true })).toBeEnabled()
})

test('non-owner can leave feedback without inventing a score; list refreshes after feedback', async ({ page }) => {
  const state = await mockStudy(page, 'friend')
  await page.goto('/study/session-1')
  await page.getByText('こんにちは', { exact: true }).click()
  const form = page.locator('form').filter({ has: page.getByPlaceholder('이 시도에 대한 피드백을 작성하세요...') })
  await expect(form.getByRole('combobox')).toHaveValue('')
  await form.getByRole('textbox').fill('첫 음절을 더 길게 말해보세요.')
  await form.getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.attempts[0].correctionNote).toBe('첫 음절을 더 길게 말해보세요.')
  expect(state.attempts[0].score).toBeNull()
  await form.getByRole('combobox').selectOption('5')
  await form.getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.attempts[0].score).toBe(5)
  await expect(page.locator('span').filter({ hasText: /^5\/5$/ })).toHaveClass(/text-green-600/)
  await page.getByRole('button', { name: '←', exact: true }).click()
  await expect(page).toHaveURL(/\/study\/session-1$/)
  await expect(page.locator('span').filter({ hasText: /^5\/5$/ })).toHaveClass(/text-green-600/)
})

test('study scores use 1–5 colors and leave unscored attempts blank', async ({ page }) => {
  const state = await mockStudy(page)
  state.scores = true
  await page.goto('/study/session-1')
  for (const score of [5, 4]) await expect(page.getByText(`${score}/5`, { exact: true })).toHaveClass(/text-green-600/)
  await expect(page.getByText('3/5', { exact: true })).toHaveClass(/text-yellow-600/)
  for (const score of [2, 1]) await expect(page.getByText(`${score}/5`, { exact: true })).toHaveClass(/text-red-500/)
  await expect(page.getByText('0/5', { exact: true })).toHaveCount(0)
  await expect(page.getByText('최근 연습', { exact: true })).toHaveCount(6)
})
