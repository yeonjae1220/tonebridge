import { test, expect, type Page } from '@playwright/test'

async function app(page: Page) {
  await page.context().addCookies([
    { name: 'session', value: 'feedback-test', domain: '127.0.0.1', path: '/' },
    { name: 'tonebridge_ui_language', value: 'ko', domain: '127.0.0.1', path: '/' },
  ])
  const notebook = { id: 'shared', title: 'Mina와 연습', createdBy: 'me', memberIds: ['me', 'friend'], status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z' }
  const card = { id: 'card', sessionId: 'shared', createdByUserId: 'me', phrase: 'こんにちは', tags: [], position: 0, createdAt: notebook.createdAt }
  const state = {
    notebook, fail: new Set<string>(), left: false, removed: false,
    writes: [] as { path: string; search: string; body: Record<string, unknown> }[],
    attempts: Array.from({ length: 8 }, (_, index) => ({
      id: 'attempt-' + index, cardId: 'card', learnerId: index === 1 ? 'friend' : 'me',
      audioUrl: 'stored.webm', correctionNote: index === 7 ? '첫 녹음에 새로 도착한 피드백' : null as string | null,
      score: null, attemptedAt: `2026-10-${String(20 - index).padStart(2, '0')}T00:00:00Z`,
      correctionAuthorId: index === 7 ? 'friend' : null,
      correctionUpdatedAt: index === 7 ? '2026-10-31T00:00:00Z' : null,
    })),
  }
  const audio = Buffer.alloc(32044)
  audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8)
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22)
  audio.writeUInt32LE(16000, 24); audio.writeUInt32LE(32000, 28); audio.writeUInt16LE(2, 32)
  audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(32000, 40)
  await page.route('**/fixture.wav', route => route.fulfill({ contentType: 'audio/wav', body: audio }))
  await page.route('**/api/**', route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (state.fail.has(path)) return route.fulfill({ status: 503, json: { message: 'try again' } })
    const ok = (json: unknown) => route.fulfill({ json })
    if (path === '/api/auth/refresh') return ok({ accessToken: 'test' })
    if (request.method() !== 'GET') {
      const body = request.postDataJSON() ?? {}
      state.writes.push({ path, search: url.search, body })
      if (path.endsWith('/correction')) {
        const target = state.attempts.find(item => path.includes('/' + item.id + '/'))!
        Object.assign(target, body)
        return ok(target)
      }
      if (path === '/api/sessions/shared/membership') state.left = true
      if (path === '/api/friends/friend') { state.removed = true; if (url.searchParams.get('closeShared') === 'true') state.left = true }
      return route.fulfill({ status: 204 })
    }
    if (path === '/api/users/me') return ok({ id: 'me', username: 'learner', uiLanguage: 'ko', nativeLanguage: 'ko', learningLanguages: ['ja'], fluentLanguages: [], onboardingCompleted: true })
    if (path === '/api/sessions') return ok(state.left ? [] : [notebook])
    if (path === '/api/sessions/shared') return ok(notebook)
    if (path === '/api/sessions/shared/cards') return ok([card])
    if (path === '/api/cards/card') return ok(card)
    if (path === '/api/cards/card/attempts') return ok(state.attempts)
    if (path.endsWith('/download-url')) return ok({ downloadUrl: 'http://127.0.0.1:3100/fixture.wav' })
    if (path === '/api/friends') return ok(state.removed ? [] : [{ id: 'friend', username: 'Mina', nativeLanguage: 'ja' }])
    if (path === '/api/practice-feedback') {
      if (state.left) return ok({ items: [], nextPage: null })
      const old = url.searchParams.get('page') === '1'
      return ok({ items: [{
        ...state.attempts[7], attemptId: old ? 'attempt-6' : 'attempt-7',
        sessionId: 'shared', sessionTitle: notebook.title, phrase: card.phrase,
        correctionNote: old ? '예전 피드백' : state.attempts[7].correctionNote,
        correctionAuthorId: old ? null : 'friend', correctionAuthorName: old ? null : 'Mina',
        correctionUpdatedAt: old ? null : '2026-10-31T00:00:00Z',
      }], nextPage: old ? null : 1 })
    }
    return ok([])
  })
  return state
}

test('feedback collection finds an older attempt, paginates, and opens the exact record', async ({ page }, info) => {
  await app(page)
  await page.goto('/study')
  await page.getByRole('link', { name: /전체 보기/ }).click()
  await expect(page).toHaveURL(/\/study\/feedback$/)
  await expect(page.getByText('첫 녹음에 새로 도착한 피드백')).toBeVisible()
  await page.getByRole('button', { name: '더 보기', exact: true }).click()
  await expect(page.getByText('예전 피드백', { exact: true })).toBeVisible()
  await expect(page.getByText('작성자 정보 없음', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('feedback-collection.png'), fullPage: true })
  await page.locator('a[href$="#attempt-attempt-7"]').click()
  const record = page.locator('#attempt-attempt-7')
  await expect(record).toBeFocused()
  await expect(record).toBeInViewport()
  await expect(page.locator('article')).toHaveCount(8)
  await expect(record.locator('textarea')).toHaveCount(0)
  await record.getByRole('button', { name: '피드백 보고 다시 연습', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('returning from fresh feedback refreshes a recently cached practice record', async ({ page }) => {
  const state = await app(page)
  await page.goto('/study/shared/cards/card#attempt-attempt-7')
  await expect(page.locator('#attempt-attempt-7').getByText('첫 녹음에 새로 도착한 피드백', { exact: true })).toBeVisible()
  state.attempts[7].correctionNote = '방금 수정된 피드백'
  await page.locator('nav').getByRole('link', { name: '스터디', exact: true }).click()
  await expect(page.getByText('방금 수정된 피드백', { exact: true })).toBeVisible()
  await page.locator('a[href$="#attempt-attempt-7"]').click()
  await expect(page.locator('#attempt-attempt-7').getByText('방금 수정된 피드백', { exact: true })).toBeVisible()
  await expect(page.locator('#attempt-attempt-7').getByText('첫 녹음에 새로 도착한 피드백', { exact: true })).toHaveCount(0)
})

test('history starts compact, filters, expands, and preserves a failed feedback edit', async ({ page }, info) => {
  const state = await app(page)
  await page.goto('/study/shared/cards/card')
  await expect(page.locator('article')).toHaveCount(5)
  await expect(page.locator('article textarea')).toHaveCount(0)
  await page.getByRole('button', { name: '상대 연습', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(1)
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await page.getByRole('button', { name: '더 보기', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(8)
  const record = page.locator('#attempt-attempt-7')
  await record.getByRole('button', { name: '피드백 수정', exact: true }).click()
  const field = record.getByRole('textbox')
  await field.fill('다시 들어보니 좋아졌어요')
  state.fail.add('/api/attempts/attempt-7/correction')
  await record.getByRole('button', { name: '저장', exact: true }).click()
  await expect(record.getByRole('alert')).toBeVisible()
  await expect(field).toHaveValue('다시 들어보니 좋아졌어요')
  state.fail.clear()
  await record.getByRole('button', { name: '저장', exact: true }).click()
  await expect(record.getByRole('textbox')).toHaveCount(0)
  await expect(record.getByText('다시 들어보니 좋아졌어요', { exact: true })).toBeVisible()
  expect(state.writes.at(-1)?.body.score).toBeNull()
  await page.getByRole('button', { name: '상대 연습', exact: true }).click()
  await page.screenshot({ path: info.outputPath('compact-history.png'), fullPage: true })
})

test('feedback load failure is retryable and unavailable deep links are explicit', async ({ page }) => {
  const state = await app(page)
  state.fail.add('/api/practice-feedback')
  await page.goto('/study/feedback')
  await expect(page.locator('main').getByRole('alert')).toBeVisible()
  state.fail.clear()
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByText('첫 녹음에 새로 도착한 피드백')).toBeVisible()
  await page.goto('/study/shared/cards/card#attempt-missing')
  await expect(page.getByText(/이 연습 기록을 찾을 수 없습니다/)).toBeVisible()
})

test('friend removal defaults to keeping sharing and requires explicit confirmation', async ({ page }) => {
  const state = await app(page)
  await page.goto('/friends')
  await page.getByRole('button', { name: '친구 삭제', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('checkbox')).not.toBeChecked()
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  expect(state.writes).toHaveLength(0)
  await page.getByRole('button', { name: '친구 삭제', exact: true }).click()
  await dialog.getByRole('button', { name: '친구 삭제', exact: true }).click()
  await expect(page.getByText('친구 관계를 삭제했습니다.', { exact: true })).toBeVisible()
  expect(state.writes.at(-1)?.search).toContain('closeShared=false')
  expect(state.left).toBe(false)
})

test('sharing closure explains both users impact and retains the option after failure', async ({ page }, info) => {
  const state = await app(page)
  await page.goto('/friends')
  await page.getByRole('button', { name: '친구 삭제', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox').check()
  await expect(dialog.getByText(/두 사람 모두 현재 함께 참여 중인/)).toBeVisible()
  await expect(dialog.getByText(/최대 15분/)).toBeVisible()
  state.fail.add('/api/friends/friend')
  await dialog.getByRole('button', { name: '친구 삭제', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('checkbox')).toBeChecked()
  await page.screenshot({ path: info.outputPath('close-sharing.png') })
  state.fail.clear()
  await dialog.getByRole('button', { name: '친구 삭제', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes.at(-1)?.search).toContain('closeShared=true')
  await page.locator('nav').getByRole('link', { name: '스터디', exact: true }).click()
  await expect(page.getByText('첫 녹음에 새로 도착한 피드백')).toHaveCount(0)
})

test('leaving explains record retention, retries failure, and returns to home', async ({ page }) => {
  const state = await app(page)
  await page.goto('/study/shared')
  await page.getByRole('button', { name: '연습장 나가기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/다른 참여자의 접근은 유지/)).toBeVisible()
  state.fail.add('/api/sessions/shared/membership')
  await dialog.getByRole('button', { name: '연습장 나가기', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  state.fail.clear()
  await dialog.getByRole('button', { name: '연습장 나가기', exact: true }).click()
  await expect(page).toHaveURL(/\/study$/)
  expect(state.left).toBe(true)
  // A non-creator must still be able to leave after the creator has already left.
  state.left = false
  state.notebook.createdBy = 'friend'
  state.notebook.memberIds = ['me']
  await page.goto('/study/shared')
  await page.getByRole('button', { name: '연습장 나가기', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '연습장 나가기', exact: true }).click()
  await expect(page).toHaveURL(/\/study$/)
  expect(state.left).toBe(true)
})
