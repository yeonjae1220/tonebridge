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
    activeUserId: userId,
    userReads: 0,
    attempts: [{ ...attempt }],
    submitted: [] as { path: string; body: Record<string, unknown> }[],
    failPractice: false,
    failUpload: false,
    uploadTypes: [] as string[],
    scores: false,
  }
  const session = { id: 'session-1', title: '언어 교환', memberIds: ['owner', 'friend'], createdBy: 'owner', status: 'ACTIVE', createdAt: card.createdAt }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') {
      const body = request.postDataJSON() as Record<string, unknown> | null
      state.submitted.push({ path, body: body ?? {} })
      if (path === '/api/auth/login') return route.fulfill({ json: { accessToken: 'new-session' } })
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
    if (path === '/api/practice-feedback') return route.fulfill({ json: { items: [], nextPage: null } })
    if (path === '/api/users/me') { state.userReads++; return route.fulfill({ json: { id: state.activeUserId, username: state.activeUserId, onboardingCompleted: true, uiLanguage: 'ko', credits: 0, nativeLanguage: 'ko', fluentLanguages: [], learningLanguages: ['ja'] } }) }
    if (path === '/api/users/me/profile') return route.fulfill({ json: { username: userId, level: 'NATIVE', reputationScore: 0, streakDays: 0, badges: [], totalCorrections: 0, adoptedCorrections: 0, nativeLanguage: 'ko', fluentLanguages: [], learningLanguages: ['ja'] } })
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
  await page.route('**/test-audio-upload', (route) => {
    state.uploadTypes.push(route.request().headers()['content-type'])
    return route.fulfill({ status: state.failUpload ? 503 : 200, body: '' })
  })
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

test('unsaved recording survives client navigation and browser back; reload is guarded', async ({ page }) => {
  await mockStudy(page)
  await page.goto('/study/session-1')
  await page.getByText('こんにちは', { exact: true }).click()
  await recordAudio(page)
  const initial = await page.locator('#recording-panel audio').evaluate(async (audio: HTMLAudioElement) => {
    const blob = await (await fetch(audio.src)).blob()
    return { size: blob.size, duration: audio.duration }
  })
  expect(Number.isFinite(initial.duration)).toBe(true)
  expect(initial.duration).toBeGreaterThan(0)
  // Cancelling explicit navigation keeps the exact preview in place.
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: '←', exact: true }).click()
  await expect(page).toHaveURL(/cards\/card-1$/)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '←', exact: true }).click()
  await expect(page).toHaveURL(/\/study\/session-1$/)
  await page.goBack()
  await expect(page.locator('#recording-panel audio')).toHaveCount(1)
  expect(await page.locator('#recording-panel audio').evaluate(async (audio: HTMLAudioElement) => (await (await fetch(audio.src)).blob()).size)).toBe(initial.size)
  const dialog = page.waitForEvent('dialog')
  const reload = page.reload({ timeout: 1000 }).catch(() => null)
  const warning = await dialog
  expect(warning.type()).toBe('beforeunload')
  await warning.dismiss()
  await reload
  await expect(page.locator('#recording-panel audio')).toHaveCount(1)
  // Native browser back need not be monkey-patched: returning restores the draft.
  await page.goBack()
  await page.getByText('こんにちは', { exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveCount(1)
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
})

test('example draft reopens in its original purpose after browser back', async ({ page }) => {
  await mockStudy(page)
  await page.goto('/study/session-1')
  await page.getByText('こんにちは', { exact: true }).click()
  await page.getByRole('button', { name: '예시 발음 추가', exact: true }).click()
  await recordAudio(page)
  await page.goBack()
  await page.getByText('こんにちは', { exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '예시 발음 추가', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('a late save after navigation cannot delete a newer draft', async ({ page }) => {
  await mockStudy(page)
  let finish!: () => void
  const held = new Promise<void>((resolve) => { finish = resolve })
  let started!: () => void
  const saving = new Promise<void>((resolve) => { started = resolve })
  await page.route('**/api/cards/card-1/attempts', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    started(); await held
    await route.fulfill({ status: 201, json: attempt })
  })
  await page.goto('/study/session-1')
  await page.getByText('こんにちは', { exact: true }).click()
  await recordAudio(page)
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await saving
  await page.goBack()
  await page.getByText('こんにちは', { exact: true }).click()
  await page.locator('#recording-panel').getByRole('button', { name: '다시 녹음', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('dialog').getByRole('button', { name: '다시 녹음', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '녹음 시작', exact: true }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '녹음 중지', exact: true }).click()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  const newer = await page.locator('#recording-panel audio').getAttribute('src')
  const response = page.waitForResponse((r) => r.url().endsWith('/attempts') && r.request().method() === 'POST')
  finish(); await response
  await page.waitForTimeout(150)
  await expect(page.locator('#recording-panel audio')).toHaveAttribute('src', newer!)
})

test('upload timeout explains the wait, preserves audio and retries the same key', async ({ page }) => {
  const state = await mockStudy(page)
  await page.goto('/study/session-1/cards/card-1')
  await recordAudio(page)
  const blobUrl = await page.locator('#recording-panel audio').getAttribute('src')
  await page.clock.install()
  let release!: () => void
  let started = false
  await page.route('**/test-audio-upload', async (route) => {
    started = true
    await new Promise<void>((resolve) => { release = resolve })
    await route.fulfill({ status: 200, body: '' }).catch(() => {})
  })
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect.poll(() => started).toBe(true)
  await page.clock.fastForward(5100)
  await expect(page.getByRole('status').filter({ hasText: '연결이 지연' })).toBeVisible()
  await page.clock.fastForward(26_000)
  await expect(page.getByRole('alert').filter({ hasText: '저장 응답이 지연' })).toBeVisible()
  await expect(page.locator('#recording-panel audio')).toHaveAttribute('src', blobUrl!)
  release()
  await page.unroute('**/test-audio-upload')
  await page.route('**/test-audio-upload', (route) => route.fulfill({ status: 200, body: '' }))
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
  expect(state.submitted.filter((entry) => entry.path.endsWith('/presigned-upload'))).toHaveLength(1)
  expect(state.submitted.filter((entry) => entry.path.endsWith('/attempts'))).toHaveLength(1)
})

test('lost save response retries confirmation without uploading a second audio object', async ({ page }) => {
  const state = await mockStudy(page)
  await page.goto('/study/session-1/cards/card-1')
  await recordAudio(page)
  await page.clock.install()
  let release!: () => void
  let firstKey: unknown
  await page.route('**/api/cards/card-1/attempts', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    firstKey = route.request().postDataJSON().audioKey
    await new Promise<void>((resolve) => { release = resolve })
    await route.fulfill({ status: 201, json: attempt }).catch(() => {})
  })
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect.poll(() => firstKey).toBe('recording.webm')
  await page.clock.fastForward(31_000)
  await expect(page.getByRole('alert').filter({ hasText: '저장 응답이 지연' })).toBeVisible()
  release()
  await page.unroute('**/api/cards/card-1/attempts')
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
  expect(state.uploadTypes).toHaveLength(1)
  expect(state.submitted.find((entry) => entry.path.endsWith('/attempts'))?.body.audioKey).toBe(firstKey)
})

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

test('microphone permission wait prevents repeated starts and purpose changes but allows closing', async ({ page }) => {
  await mockStudy(page)
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise((_resolve, reject) => {
      window.addEventListener('test:deny-microphone', () => reject(new DOMException('Denied', 'NotAllowedError')), { once: true })
    })
  })
  await page.goto('/study/session-1/cards/card-1')
  await page.locator('#recording-panel').getByRole('button', { name: '녹음 시작', exact: true }).click()
  await page.getByRole('button', { name: '녹음 시작', exact: true }).last().click()
  await expect(page.getByRole('dialog').getByRole('button', { name: '녹음 시작', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '닫기', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: '예시 발음 추가', exact: true, includeHidden: true })).toBeDisabled()
  await page.evaluate(() => window.dispatchEvent(new Event('test:deny-microphone')))
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByRole('button', { name: '예시 발음 추가', exact: true })).toBeEnabled()
})

test('non-owner can leave feedback without inventing a score; list refreshes after feedback', async ({ page }) => {
  const state = await mockStudy(page, 'friend')
  await page.goto('/study/session-1')
  await page.getByText('こんにちは', { exact: true }).click()
  await page.getByRole('button', { name: '피드백 작성', exact: true }).click()
  const form = page.locator('form').filter({ has: page.getByPlaceholder('이 시도에 대한 피드백을 작성하세요...') })
  await expect(form.getByRole('combobox')).toHaveValue('')
  await form.getByRole('textbox').fill('첫 음절을 더 길게 말해보세요.')
  await form.getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.attempts[0].correctionNote).toBe('첫 음절을 더 길게 말해보세요.')
  expect(state.attempts[0].score).toBeNull()
  await page.getByRole('button', { name: '피드백 수정', exact: true }).click()
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


test('MP4-only capability selects m4a and matching upload headers', async ({ page }) => {
  const state = await mockStudy(page)
  // Contract simulation, not an iPhone codec test: encode with Chromium, expose MP4 capability.
  await page.addInitScript(() => {
    const BrowserRecorder = window.MediaRecorder
    class Mp4ContractRecorder extends BrowserRecorder {
      static isTypeSupported(type: string) { return type === 'audio/mp4' }
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        if (options?.mimeType !== 'audio/mp4') throw new Error('MP4 was not selected')
        super(stream, { mimeType: 'audio/webm;codecs=opus' })
      }
      get mimeType() { return 'audio/mp4' }
    }
    window.MediaRecorder = Mp4ContractRecorder
  })
  await page.goto('/study/session-1/cards/card-1')
  await recordAudio(page)
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
  const signature = state.submitted.find((entry) => entry.path.endsWith('/presigned-upload'))!
  expect(signature.body.fileName).toMatch(/\.m4a$/)
  expect(signature.body.contentType).toBe('audio/mp4')
  expect(state.uploadTypes).toEqual(['audio/mp4'])
})

test('object upload failure keeps the same audio for retry and does not save an attempt', async ({ page }) => {
  const state = await mockStudy(page)
  state.failUpload = true
  await page.goto('/study/session-1/cards/card-1')
  await recordAudio(page)
  const url = await page.locator('#recording-panel audio').getAttribute('src')
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect(page.getByText('녹음을 제출하지 못했습니다. 다시 시도해주세요.')).toBeVisible()
  await expect(page.locator('#recording-panel audio')).toHaveAttribute('src', url!)
  expect(state.submitted.some((entry) => entry.path.endsWith('/attempts'))).toBe(false)
  state.failUpload = false
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
  expect(state.uploadTypes).toEqual(['audio/webm', 'audio/webm'])
})

test('leaving a card while microphone permission is pending stops the late stream', async ({ page }) => {
  await mockStudy(page)
  await page.addInitScript(() => {
    const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getMedia(constraints)
      Object.assign(window, { testStream: stream })
      await new Promise((resolve) => window.addEventListener('test:allow', resolve, { once: true }))
      return stream
    }
  })
  await page.goto('/study/session-1/cards/card-1')
  await page.locator('#recording-panel').getByRole('button', { name: '녹음 시작', exact: true }).click()
  await page.getByRole('button', { name: '녹음 시작', exact: true }).last().click()
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { testStream?: MediaStream }).testStream)).toBe(true)
  // Cancel the permission wait before using navigation behind the modal.
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  // The app's bottom navigation performs client navigation, retaining the pending promise.
  await page.getByRole('link', { name: '친구', exact: true }).click()
  await expect(page).toHaveURL(/\/friends$/)
  await page.evaluate(() => window.dispatchEvent(new Event('test:allow')))
  await expect.poll(() => page.evaluate(() => (window as unknown as { testStream: MediaStream }).testStream.getTracks().every((track) => track.readyState === 'ended'))).toBe(true)
})

test('help submission keeps the draft on failure and confirms receipt only after success', async ({ page }, testInfo) => {
  await mockStudy(page)
  let fail = true
  await page.route('**/api/feedback', (route) => route.fulfill({ status: fail ? 503 : 200, json: { ok: !fail } }))
  await page.goto('/help')
  await page.screenshot({ path: testInfo.outputPath('help.png'), fullPage: true })
  const message = page.getByRole('textbox', { name: '문의 내용' })
  await message.fill('공유 연습장 접근 중단을 요청합니다.')
  await page.getByRole('button', { name: '문의 보내기' }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('내용은 유지')
  await expect(message).toHaveValue('공유 연습장 접근 중단을 요청합니다.')
  fail = false
  await page.getByRole('button', { name: '문의 보내기' }).click()
  await expect(page.getByRole('status')).toContainText('확인 후 처리')
})


test('upload finishing after logout never confirms a practice under another session', async ({ page }) => {
  const state = await mockStudy(page)
  let finishUpload!: () => void
  let uploading = false
  const uploadGate = new Promise<void>((resolve) => { finishUpload = resolve })
  await page.route('**/test-audio-upload', async (route) => {
    uploading = true
    await uploadGate
    await route.fulfill({ status: 200, body: '' })
  })
  await page.goto('/study/session-1/cards/card-1')
  await recordAudio(page)
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect.poll(() => uploading).toBe(true)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('link', { name: '프로필', exact: true }).click()
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByRole('button', { name: /로그아웃/ }).click()
  await expect(page).toHaveURL(/\/login/)
  state.activeUserId = 'another-user'
  const readsBeforeLogin = state.userReads
  await page.getByLabel('이메일', { exact: true }).fill('another@example.com')
  await page.getByLabel('비밀번호', { exact: true }).fill('Password1!')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/\/study$/)
  await expect.poll(() => state.userReads).toBeGreaterThan(readsBeforeLogin)
  finishUpload()
  // Wait for the upload's completion and the account guard microtask.
  await page.waitForTimeout(300)
  expect(state.submitted.filter((entry) => entry.path.endsWith('/attempts'))).toEqual([])
})

test('denied microphone can be allowed on the next attempt without reloading', async ({ page }) => {
  await mockStudy(page)
  await page.addInitScript(() => {
    const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    let denied = false
    navigator.mediaDevices.getUserMedia = (constraints) => {
      if (!denied) { denied = true; return Promise.reject(new DOMException('Denied', 'NotAllowedError')) }
      return getMedia(constraints)
    }
  })
  await page.goto('/study/session-1/cards/card-1')
  await page.locator('#recording-panel').getByRole('button', { name: '녹음 시작', exact: true }).click()
  await page.getByRole('button', { name: '녹음 시작', exact: true }).last().click()
  await expect(page.locator('p[role="alert"]')).toBeVisible()
  await page.getByRole('button', { name: '녹음 시작', exact: true }).last().click()
  await expect(page.getByRole('button', { name: '녹음 중지', exact: true })).toBeVisible()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '녹음 중지', exact: true }).click()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('#recording-panel audio')).toHaveAttribute('src', /^blob:/)
})
