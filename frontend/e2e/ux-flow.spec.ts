import { expect, test, type Page } from '@playwright/test'

function wav() {
  const buffer = Buffer.alloc(32044)
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(16000, 24); buffer.writeUInt32LE(32000, 28)
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36)
  buffer.writeUInt32LE(32000, 40)
  return buffer
}

async function app(page: Page) {
  await page.context().addCookies([
    { name: 'session', value: 'ux-test', domain: '127.0.0.1', path: '/' },
    { name: 'tonebridge_ui_language', value: 'ko', domain: '127.0.0.1', path: '/' },
  ])
  const session = { id: 'shared', title: 'Mina와 연습', memberIds: ['me', 'friend'], createdBy: 'me', status: 'ACTIVE', createdAt: '2026-10-29T00:00:00Z' }
  const attempt = { id: 'attempt-1', cardId: 'card-1', learnerId: 'me', audioUrl: 'practice.webm', correctionNote: '첫 음절을 조금 길게 말해보세요.', score: null, attemptedAt: '2026-10-29T01:00:00Z' }
  const state = {
    card: { id: 'card-1', sessionId: 'shared', createdByUserId: 'me', phrase: 'こんにちは', context: '친구와 인사할 때', tags: [], note: 'private note', position: 0, createdAt: session.createdAt, latestAttempt: attempt },
    fail: new Set<string>(), empty: false, guest: false,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    audioKeys: [] as string[],
  }
  await page.route('**/ux-audio.wav', (route) => route.fulfill({ contentType: 'audio/wav', body: wav() }))
  await page.route('**/api/**', (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (state.fail.has(path)) return route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } })
    const ok = (json: unknown) => route.fulfill({ json })
    if (path === '/api/auth/refresh') return route.fulfill({ status: state.guest ? 401 : 200, json: { accessToken: 'ux-test' } })
    if (request.method() !== 'GET') {
      const body = request.postDataJSON() ?? {}
      state.writes.push({ path, body })
      if (path === '/api/cards/card-1') state.card = { ...state.card, ...body }
      if (path === '/api/sessions') return ok(session)
      if (path.startsWith('/api/compositions/')) return ok({ type: 'community', requestId: 'composed' })
      return ok({ ...state.card, ...body })
    }
    if (path.startsWith('/api/compositions/')) return route.fulfill({ status: 404, json: {} })
    if (path === '/api/practice-feedback') return ok({ items: state.empty ? [] : [{ ...attempt, attemptId: attempt.id, sessionId: session.id, sessionTitle: session.title, phrase: state.card.phrase, correctionAuthorId: null, correctionAuthorName: null, correctionUpdatedAt: null }], nextPage: null })
    if (path === '/api/users/me') return ok({ id: 'me', username: 'learner', uiLanguage: 'ko', nativeLanguage: 'ko', fluentLanguages: [], learningLanguages: ['ja'], onboardingCompleted: true, credits: 0 })
    if (path === '/api/sessions') return ok(state.empty ? [] : [session])
    if (path === '/api/sessions/shared') return ok(session)
    if (path === '/api/sessions/shared/cards') return ok([state.card])
    if (path === '/api/cards/card-1') return ok(state.card)
    if (path === '/api/cards/card-1/attempts') return ok([attempt])
    if (path === '/api/cards/card-1/native-audios') return ok([{ id: 'example-1', cardId: 'card-1', createdAt: session.createdAt }])
    if (path === '/api/attempts/attempt-1/download-url') { state.audioKeys.push(path); return ok({ downloadUrl: 'http://127.0.0.1:3100/ux-audio.wav' }) }
    if (path === '/api/native-audios/example-1/download-url') return ok({ downloadUrl: 'http://127.0.0.1:3100/ux-audio.wav' })
    if (path === '/api/friends') return ok(state.empty ? [] : [{ id: 'friend', username: 'Mina', nativeLanguage: 'ja' }])
    if (path === '/api/languages/variants') return ok({})
    if (path === '/api/correction-requests/feed/page') return ok({ items: [], nextCursor: null })
    return ok([])
  })
  return state
}

test('card create and edit save above navigation; failed edit retains the draft', async ({ page }, info) => {
  const state = await app(page)
  await page.goto('/study/shared')
  await page.getByRole('button', { name: '카드 추가', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '표현', exact: true }).fill('안녕하세요')
  const save = dialog.getByRole('button', { name: '저장', exact: true })
  await expect(save).toBeInViewport()
  expect(await save.evaluate((button) => {
    const bounds = button.getBoundingClientRect()
    return button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))
  })).toBe(true)
  await page.screenshot({ path: info.outputPath('card-dialog.png') })
  await save.click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes.at(-1)?.body.phrase).toBe('안녕하세요')
  await page.getByText('카드 관리', { exact: true }).click()
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await dialog.getByRole('textbox', { name: '표현', exact: true }).fill('다시 수정한 표현')
  state.fail.add('/api/cards/card-1')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '표현', exact: true })).toHaveValue('다시 수정한 표현')
  state.fail.clear()
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('다시 수정한 표현', { exact: true })).toBeVisible()
})

test('saved practice resolves an authorized URL, plays after reload, and retries failures', async ({ page }) => {
  const state = await app(page)
  state.fail.add('/api/attempts/attempt-1/download-url')
  await page.goto('/study/shared/cards/card-1')
  const history = page.locator('section').filter({ has: page.getByRole('heading', { name: '연습 기록', exact: true }) })
  await expect(history.getByRole('alert')).toBeVisible()
  state.fail.clear()
  await history.getByRole('button', { name: '다시 시도' }).click()
  await expect(history.locator('audio')).toHaveAttribute('src', /ux-audio.wav/)
  expect(state.audioKeys).toContain('/api/attempts/attempt-1/download-url')
  await history.locator('audio').evaluate((audio: HTMLAudioElement) => audio.play())
  expect(await history.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(false)
  await page.reload()
  await expect(history.locator('audio')).toHaveAttribute('src', /ux-audio.wav/)
  await history.locator('audio').dispatchEvent('error')
  await expect(history.getByRole('alert')).toBeVisible()
  await history.getByRole('button', { name: '다시 시도' }).click()
  await expect(history.locator('audio')).toHaveAttribute('src', /ux-audio.wav/)
  await page.getByRole('button', { name: '피드백 보고 다시 연습', exact: true }).click()
  await expect(page.getByRole('button', { name: '녹음 시작', exact: true }).last()).toBeVisible()
})

test('card, example, and history fetch errors have explicit retry instead of empty or endless loading', async ({ page }) => {
  const state = await app(page)
  state.fail.add('/api/cards/card-1')
  await page.goto('/study/shared/cards/card-1')
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  await expect(page.locator('audio')).toHaveCount(0)
  state.fail.clear()
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByText('こんにちは', { exact: true })).toBeVisible()
  state.fail.add('/api/cards/card-1/attempts'); state.fail.add('/api/cards/card-1/native-audios')
  await page.reload()
  await expect(page.locator('main').getByRole('alert')).toHaveCount(2)
  state.fail.clear()
  for (const name of ['예시 발음 목록', '연습 기록']) {
    await page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('button', { name: '다시 시도' }).click()
  }
  await expect(page.locator('main').getByRole('alert')).toHaveCount(0)
  await expect(page.locator('audio')).toHaveCount(2)
})

test('community action copies only reviewed text and preserves the public destination', async ({ page }) => {
  const state = await app(page)
  await page.goto('/study/shared/cards/card-1')
  await page.getByRole('button', { name: '커뮤니티에 요청', exact: true }).click()
  await expect(page).toHaveURL(/destination=COMMUNITY&sourceCard=card-1/)
  await expect(page.getByRole('textbox').first()).toHaveValue('こんにちは')
  expect(state.writes).toEqual([])
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await expect(page.getByRole('button', { name: /커뮤니티에 요청/ })).toHaveClass(/border-blue-300/)
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await expect(page.getByRole('textbox')).toHaveValue('친구와 인사할 때')
  await page.getByRole('button', { name: /日本語|일본어/ }).first().click()
  await page.getByRole('button', { name: '교정 요청하기', exact: true }).click()
  await expect(page).toHaveURL(/\/community$/)
  const request = state.writes.find((write) => write.path.startsWith('/api/compositions/'))!
  expect(request.body.contentText).toBe('こんにちは')
  expect(request.body).not.toHaveProperty('audioKey')
  expect(JSON.stringify(request.body)).not.toContain('private note')
})

test('home links start writing or recording directly and friend creation opens in view', async ({ page }, info) => {
  await app(page)
  await page.goto('/study')
  await expect(page.getByText('내 연습에 달린 피드백', { exact: true })).toBeVisible()
  await expect(page.getByText('첫 음절을 조금 길게 말해보세요.', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true })
  await page.getByRole('button', { name: '친구와 시작하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeInViewport()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('link', { name: '글 작성', exact: true }).click()
  await expect(page.getByRole('textbox').first()).toBeVisible()
  await page.goto('/study')
  await page.getByRole('link', { name: '녹음', exact: true }).click()
  await expect(page.getByRole('button', { name: '녹음 시작', exact: true }).last()).toBeVisible()
})

test('first-use home has two clear starting paths without zero counters', async ({ page }) => {
  const state = await app(page); state.empty = true
  await page.goto('/study')
  await expect(page.getByRole('link', { name: '친구 초대 링크', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '혼자 첫 표현 기록', exact: true })).toBeVisible()
  await expect(page.getByText('받은 것', { exact: true })).toHaveCount(0)
})

for (const theme of ['light', 'dark']) {
  test(`${theme} action labels have readable contrast and listening precedes recording`, async ({ page }, info) => {
    await app(page)
    await page.addInitScript((value) => localStorage.setItem('tonebridge_theme', value), theme)
    await page.goto('/study/shared/cards/card-1')
    await expect(page.locator('audio')).toHaveCount(2)
    const examples = page.getByRole('heading', { name: '예시 발음 목록', exact: true })
    const recording = page.locator('#recording-panel')
    expect((await examples.boundingBox())!.y).toBeLessThan((await recording.boundingBox())!.y)
    const contrast = await page.locator('button.bg-action-neutral, button.bg-action-primary, button.bg-action-record').evaluateAll((buttons) => {
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 })
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
      }
      return buttons.filter((button) => !(button as HTMLButtonElement).disabled).map((button) => {
        const style = getComputedStyle(button), a = luminance(style.color), b = luminance(style.backgroundColor)
        return { text: button.textContent, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
      })
    })
    expect(contrast.length).toBeGreaterThan(3)
    for (const result of contrast) expect(result.ratio, result.text ?? '').toBeGreaterThanOrEqual(4.5)
    await page.screenshot({ path: info.outputPath(`card-${theme}.png`), fullPage: true })
    if (info.project.name === 'desktop') {
      const recordButton = recording.getByRole('button', { name: '녹음 시작', exact: true })
      await recordButton.hover()
      await expect(recordButton).toHaveCSS('background-color', 'rgb(153, 27, 27)')
      await expect(recordButton).toHaveCSS('color', 'rgb(255, 255, 255)')
    }
  })
}

test('two-step onboarding supports back, retains language choices, and optional fields stay optional', async ({ page }) => {
  const state = await app(page)
  await page.goto('/onboarding')
  await page.getByRole('button', { name: /한국어/ }).click()
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByRole('button', { name: /日本語|일본어/ }).first().click()
  await page.getByRole('button', { name: '이전', exact: true }).click()
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByRole('button', { name: '시작하기', exact: true }).click()
  await expect(page).toHaveURL(/\/study$/)
  expect(state.writes.find((write) => write.path.endsWith('/onboarding'))?.body).toMatchObject({ nativeLanguage: 'ko', learningLanguages: ['ja'], uiLanguage: 'ko' })
})

test('landing preview works without login and narrow headers stay within the viewport', async ({ page }, info) => {
  const state = await app(page); state.guest = true
  await page.context().clearCookies()
  await page.context().addCookies([{ name: 'tonebridge_ui_language', value: 'ko', domain: '127.0.0.1', path: '/' }])
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.getByRole('link', { name: /학습 예시 보기/ }).click()
  await expect(page).toHaveURL(/#practice-preview$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  await page.screenshot({ path: info.outputPath('landing.png'), fullPage: true })
  await page.goto('/community')
  await expect(page.getByText('현재 내 언어 능력으로 교정할 수 있는 요청이 없습니다')).toHaveCount(0)
})
