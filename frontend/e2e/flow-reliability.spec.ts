import { expect, test, type Page } from '@playwright/test'

function wav() {
  const bytes = Buffer.alloc(44 + 16000)
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(16000, 40)
  return bytes
}
async function fixture(page: Page) {
  const state = {
    viewer: 'owner', fail: new Set<string>(), errors: [] as string[], uploads: 0,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    request: { id: 'request-1', requesterId: 'owner', type: 'TEXT', contentText: 'Original practice', audioUrl: 'audio/fixture.wav',
      targetLanguage: 'ko', feedbackGoals: [], context: '', status: 'PENDING', createdAt: new Date().toISOString() },
    corrections: [{ id: 'correction-1', requestId: 'request-1', correctorId: 'helper', correctedText: 'Corrected practice',
      explanation: 'A sufficiently detailed explanation for practice.', tags: [], status: 'APPROVED', isAi: false,
      likeCount: 0, likedByMe: false, isAccepted: false, createdAt: new Date().toISOString() }],
  }
  page.on('pageerror', e => state.errors.push(e.message))
  await page.context().addCookies([{ name: 'session', value: 'fixture', domain: '127.0.0.1', path: '/' }])
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    const ok = (json: unknown) => route.fulfill({ json })
    if (method !== 'GET') state.writes.push({ path, body: req.postData() ? req.postDataJSON() : {} })
    if (state.fail.has(`${method} ${path}`)) return route.fulfill({ status: 503, json: { message: '잠시 후 다시 시도해 주세요.' } })
    if (path.startsWith('/api/auth/')) return ok({ accessToken: 'fixture' })
    if (path.startsWith('/api/sse/')) return route.fulfill({ contentType: 'text/event-stream', body: ': connected\n\n' })
    if (path === '/api/users/me' || path === '/api/users/me/profile') return ok({ id: state.viewer, username: 'learner', onboardingCompleted: true,
      nativeLanguage: 'ko', uiLanguage: 'ko', learningLanguages: ['ja'], fluentLanguages: [], badges: [], correctorLevel: 'NATIVE', reputationScore: 0, correctionStreak: 0 })
    if (path === '/api/users/me/username') return ok({})
    if (path === '/api/languages/variants') return ok({})
    if (path === '/api/correction-requests/feed/page') return ok({ items: [state.request], nextCursor: null })
    if (path === '/api/correction-requests/mine') return ok([state.request])
    if (path.startsWith('/api/correction-requests/')) {
      if (method === 'PATCH') Object.assign(state.request, req.postDataJSON())
      return ok({ ...state.request, id: path.split('/').at(-1) })
    }
    if (path.startsWith('/api/corrections/request/')) return ok(state.corrections)
    if (path === '/api/sessions') return ok([{ id: 'session-1', title: 'My practice', memberIds: [state.viewer], createdBy: state.viewer }])
    if (path === '/api/sessions/session-1/cards') return ok({ id: 'saved-card' })
    if (path === '/api/storage/presigned-download') return ok({ downloadUrl: 'http://127.0.0.1:3100/flow-audio.wav' })
    if (path === '/api/storage/presigned-upload') return ok({ audioKey: 'audio/reference.webm', uploadUrl: 'http://127.0.0.1:3100/flow-upload' })
    if (path === '/api/practice-feedback' || path === '/api/friends/sent') return ok({ items: [], nextPage: null })
    return ok([])
  })
  await page.route('**/flow-audio.wav', route => state.fail.has('audio')
    ? route.fulfill({ status: 403, body: 'expired' }) : route.fulfill({ contentType: 'audio/wav', body: wav() }))
  await page.route('**/flow-upload', route => { state.uploads++; return route.fulfill({ status: 200 }) })
  return state
}

test('community query errors have retry and do not claim empty counts or empty lists', async ({ page }) => {
  const state = await fixture(page)
  state.fail.add('GET /api/correction-requests/feed/page'); state.fail.add('GET /api/correction-requests/mine')
  await page.goto('/community')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.getByText('—', { exact: true })).toHaveCount(3)
  state.fail.delete('GET /api/correction-requests/feed/page')
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByText('Original practice', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '내 요청', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  state.fail.clear()
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByText('Original practice', { exact: true })).toBeVisible()
})

test('result detail and correction list distinguish failures from waiting for feedback', async ({ page }) => {
  const state = await fixture(page)
  state.fail.add('GET /api/correction-requests/request-1'); state.fail.add('GET /api/corrections/request/request-1')
  await page.goto('/result/request-1')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.getByText('첨삭 대기 중', { exact: true })).toHaveCount(0)
  state.fail.delete('GET /api/correction-requests/request-1')
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByText('Original practice', { exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  state.fail.clear()
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByText('Corrected practice', { exact: true })).toBeVisible()
  expect(state.errors).toEqual([])
})

test('saving feedback as a card retries session lookup and retains edits after a failed save', async ({ page }, info) => {
  const state = await fixture(page)
  state.fail.add('GET /api/sessions')
  await page.goto('/result/request-1')
  await page.getByRole('button', { name: '스터디 카드로 저장', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toHaveCount(0)
  state.fail.clear()
  await dialog.getByRole('button', { name: '다시 시도', exact: true }).click()
  await dialog.getByLabel('표현', { exact: true }).fill('My retained phrase')
  state.fail.add('POST /api/sessions/session-1/cards')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByLabel('표현', { exact: true })).toHaveValue('My retained phrase')
  const save = dialog.getByRole('button', { name: '저장', exact: true })
  await save.scrollIntoViewIfNeeded()
  expect(await save.evaluate(button => { const r = button.getBoundingClientRect(); return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) })).toBe(true)
  await page.screenshot({ path: info.outputPath('feedback-save-dialog.png') })
  state.fail.clear(); await save.click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('link', { name: /카드 열기/ })).toHaveAttribute('href', '/study/session-1/cards/saved-card')
})

test('request edit stays above navigation and failed saving preserves content', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/community')
  await page.getByRole('button', { name: '내 요청', exact: true }).click()
  await page.getByRole('button', { name: '수정', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').first().fill('Retained request')
  state.fail.add('PATCH /api/correction-requests/request-1')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox').first()).toHaveValue('Retained request')
  state.fail.clear(); await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Retained request', { exact: true })).toBeVisible()
})

test('correction editor retains failed edits and other users cannot edit the original request', async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'
  await page.goto('/result/request-1')
  await expect(page.getByRole('button', { name: '수정', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: '수정', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').last().fill('A revised explanation retained for another retry.')
  state.fail.add('PATCH /api/corrections/correction-1')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox').last()).toHaveValue('A revised explanation retained for another retry.')
  state.fail.clear(); await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

test('feedback cannot submit without the original request or while recording; retry reuses uploaded audio', async ({ page }) => {
  const state = await fixture(page); state.request.type = 'AUDIO'; state.viewer = 'helper'
  state.fail.add('GET /api/correction-requests/request-1')
  await page.goto('/correct/request-1')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: '첨삭 제출하기', exact: true })).toHaveCount(0)
  state.fail.clear(); await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await page.getByRole('textbox').last().fill('A detailed explanation that must stay when submission fails.')
  await page.getByRole('button', { name: /녹음 시작/ }).click()
  const submit = page.getByRole('button', { name: '첨삭 제출하기', exact: true })
  await expect(submit).toBeDisabled()
  await expect(page.getByRole('button', { name: /중지/ })).toBeVisible()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /중지/ }).click()
  await expect(submit).toBeEnabled()
  state.fail.add('POST /api/corrections'); await submit.click()
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  expect(state.uploads).toBe(1)
  state.fail.clear(); await submit.click()
  await expect(page).toHaveURL(/community$/)
  expect(state.uploads).toBe(1)
  expect(state.errors).toEqual([])
})

test('media fetch failure is visible, retry restores playback and IME Enter does not add a comment', async ({ page }) => {
  const state = await fixture(page); state.request.type = 'AUDIO'; state.fail.add('audio')
  await page.goto('/correct/request-1')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  state.fail.clear(); await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  const play = page.getByRole('button', { name: /▶.*재생/ })
  await expect(play).toBeEnabled(); await play.click()
  await expect(page.getByRole('button', { name: /⏸/ })).toBeVisible()
  const comment = page.getByRole('textbox').first()
  await comment.fill('한글 발음')
  await comment.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  await expect(comment).toHaveValue('한글 발음')
  await comment.dispatchEvent('keydown', { key: 'Enter', keyCode: 229 })
  await expect(comment).toHaveValue('한글 발음')
  await comment.press('Enter')
  await expect(comment).toHaveValue('')
  await expect(page.getByText('한글 발음', { exact: true })).toBeVisible()
  await page.goto('/community')
  expect(state.errors).toEqual([])
})

test('profile lookup retries instead of blank content and IME does not save a nickname', async ({ page }) => {
  const state = await fixture(page); state.fail.add('GET /api/users/me/profile')
  await page.goto('/profile')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  state.fail.clear(); await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await page.getByRole('button', { name: /닉네임.*변경|닉네임.*수정/ }).click()
  const input = page.locator('#nickname-input'); await input.fill('new_name')
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await input.dispatchEvent('keydown', { key: 'Enter', keyCode: 229 })
  expect(state.writes.filter(w => w.path === '/api/users/me/username')).toHaveLength(0)
  await input.press('Enter')
  await expect(input).toHaveCount(0)
  expect(state.writes.filter(w => w.path === '/api/users/me/username')).toHaveLength(1)
})


test('leaving while audio downloads does not report an unhandled cancellation', async ({ page }) => {
  const state = await fixture(page); state.request.type = 'AUDIO'
  let requested = false
  await page.route('**/flow-audio.wav', () => { requested = true })
  await page.goto('/correct/request-1')
  await expect.poll(() => requested).toBe(true)
  await page.getByRole('button', { name: '커뮤니티', exact: true }).click()
  await expect(page).toHaveURL(/community$/)
  await expect(page.getByRole('button', { name: '도와줄 요청', exact: true })).toBeVisible()
  expect(state.errors).toEqual([])
})


test('reference recordings stay with their original community request', async ({ page }) => {
  const state = await fixture(page); state.request.type = 'AUDIO'; state.viewer = 'helper'
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/correct/request-1')
  await page.getByRole('button', { name: /녹음 시작/ }).click()
  await expect(page.getByRole('button', { name: /중지/ })).toBeVisible()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /중지/ }).click()
  await expect(page.locator('audio[controls]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolve, reject) => {
    const open = indexedDB.open('tonebridge-recording-drafts')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const read = db.transaction('drafts').objectStore('drafts').getAll()
      read.onsuccess = () => { resolve(read.result.some(row => row.scope === 'correction-reference:request-1' && row.draft?.blob?.size > 0)); db.close() }
      read.onerror = () => { reject(read.error); db.close() }
    }
  }))).toBe(true)
  await page.goto('/correct/request-2')
  await expect(page.getByRole('button', { name: /녹음 시작/ })).toBeEnabled()
  await expect(page.locator('audio[controls]')).toHaveCount(0)
  await page.goto('/correct/request-1')
  await expect(page.locator('audio[controls]')).toBeVisible()
  expect(state.errors).toEqual([])
})
