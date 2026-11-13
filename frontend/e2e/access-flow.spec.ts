import { test, expect, type Page } from '@playwright/test'

async function fixture(page: Page, guest = false) {
  await page.context().addCookies([{ name: 'tonebridge_ui_language', value: 'ko', domain: '127.0.0.1', path: '/' }])
  if (!guest) await page.context().addCookies([{ name: 'session', value: 'access-test', domain: '127.0.0.1', path: '/' }])
  const state = { posts: [] as { path: string; body: Record<string, unknown> }[], sentFailure: false, accepted: false, compositionFailure: false }
  await page.route('**/api/**', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    const ok = (json: unknown) => route.fulfill({ json })
    if (path === '/api/auth/refresh') return route.fulfill({ status: guest ? 401 : 200, json: { accessToken: 'access-test' } })
    if (req.method() === 'POST') {
      state.posts.push({ path, body: req.postDataJSON() ?? {} })
      if (path === '/api/auth/register' || path === '/api/auth/login') return route.fulfill({ status: 503, json: {} })
      if (path.startsWith('/api/compositions/') && state.compositionFailure) return route.fulfill({ status: 503, json: {} })
      if (path.startsWith('/api/compositions/')) return ok({ type: 'study', sessionId: 'personal', cardId: 'saved' })
      return ok({})
    }
    if (path === '/api/users/me/profile') return ok({ id: 'me', username: 'learner', nativeLanguage: 'ko', uiLanguage: 'ko', fluentLanguages: [], badges: [], correctorLevel: 'NATIVE', reputationScore: 0, correctionStreak: 0 })
    if (path === '/api/users/me') return ok({ id: 'me', username: 'learner', nativeLanguage: 'ko', uiLanguage: 'ko', fluentLanguages: [], learningLanguages: ['en'], onboardingCompleted: true })
    if (path === '/api/friends/sent') {
      if (state.sentFailure) return route.fulfill({ status: 503, json: {} })
      const pageNumber = url.searchParams.get('page') ?? '0'
      return ok({ items: state.accepted ? [] : [{ id: `sent-${pageNumber}`, receiverId: `friend-${pageNumber}`, receiverUsername: pageNumber === '0' ? 'Mina' : 'Alex', createdAt: '2026-11-13T00:00:00Z' }], nextPage: !state.accepted && pageNumber === '0' ? 1 : null })
    }
    if (path === '/api/friends') return ok(state.accepted ? [{ id: 'friend-0', username: 'Mina', nativeLanguage: 'en' }] : [])
    if (path === '/api/practice-feedback') return ok({ items: [], nextPage: null })
    if (path.startsWith('/api/compositions/')) return route.fulfill({ status: 404, json: {} })
    if (path === '/api/cards/saved') return ok({ id: 'saved', sessionId: 'personal', phrase: 'Hello', createdByUserId: 'me', tags: [], createdAt: '2026-11-13T00:00:00Z' })
    if (path === '/api/sessions/personal') return ok({ id: 'personal', memberIds: ['me'], createdBy: 'me', createdAt: '2026-11-13T00:00:00Z' })
    if (path === '/api/languages/variants') return ok({})
    return ok([])
  })
  return state
}

test('signup explains invalid fields before sending, focuses first error and retains failed input', async ({ page }) => {
  const state = await fixture(page, true)
  await page.goto('/signup')
  await page.getByRole('button', { name: '가입하기', exact: true }).click()
  await expect(page.getByLabel('이메일', { exact: true })).toBeFocused()
  expect(state.posts).toHaveLength(0)
  await page.getByLabel('이메일', { exact: true }).fill('review@example.test')
  await page.getByLabel('닉네임', { exact: true }).fill('review_user')
  await page.getByLabel('비밀번호', { exact: true }).fill('Short1!')
  await page.getByRole('button', { name: '가입하기', exact: true }).click()
  await expect(page.locator('#password-error')).toContainText('8~100')
  expect(state.posts).toHaveLength(0)
  await page.getByLabel('비밀번호', { exact: true }).fill('ValidPass123!')
  await page.getByRole('button', { name: '가입하기', exact: true }).click()
  await expect.poll(() => state.posts.length).toBe(1)
  await expect(page.getByLabel('이메일', { exact: true })).toHaveValue('review@example.test')
})

test('login has explicit validation and an honest recovery route', async ({ page }) => {
  const state = await fixture(page, true)
  await page.goto('/login')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.locator('#email-error')).toBeVisible()
  expect(state.posts).toHaveLength(0)
  await page.getByRole('link', { name: '계정에 접속할 수 없나요?' }).click()
  await expect(page.locator('#account-access')).toContainText('자동 비밀번호 재설정은 아직 지원하지 않습니다')
  await expect(page.getByText(/마지막 보관 후 7일/)).toBeVisible()
})

test('installation prompt survives navigation and settings always expose manual guidance', async ({ page }) => {
  await fixture(page)
  await page.goto('/study')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.evaluate(() => {
    const prompt = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(prompt, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    window.dispatchEvent(prompt)
  })
  await page.getByRole('link', { name: '프로필', exact: true }).click()
  await page.getByRole('button', { name: '앱 설치', exact: true }).click()
  await expect(page.getByText('앱으로 실행 중입니다.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '설치 방법', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Chrome 또는 Edge')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
})

test('personal content saves on the first step through the existing composition endpoint', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/request?destination=PERSONAL&kind=TEXT')
  await page.locator('textarea').fill('Hello')
  await page.getByRole('button', { name: '개인 연습장에 저장', exact: true }).click()
  await expect(page).toHaveURL(/study\/personal\/cards\/saved/)
  const writes = state.posts.filter(p => p.path.startsWith('/api/compositions/'))
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toMatchObject({ destination: 'PERSONAL', contentText: 'Hello' })
})

test('failed quick save exposes resume immediately and reuses the same request identity', async ({ page }) => {
  const state = await fixture(page)
  state.compositionFailure = true
  await page.goto('/request?destination=PERSONAL&kind=TEXT')
  await page.locator('textarea').fill('Keep my draft')
  await page.getByRole('button', { name: '개인 연습장에 저장', exact: true }).click()
  await expect.poll(() => state.posts.filter(p => p.path.startsWith('/api/compositions/')).length).toBe(1)
  const resume = page.getByRole('button', { name: '이어서 저장', exact: true })
  await expect(resume).toBeEnabled()
  state.compositionFailure = false
  await resume.click()
  await expect(page).toHaveURL(/study\/personal\/cards\/saved/)
  const writes = state.posts.filter(p => p.path.startsWith('/api/compositions/'))
  expect(writes).toHaveLength(2)
  expect(writes[0].path).toBe(writes[1].path)
  expect(writes[1].body).toEqual(writes[0].body)
})

test('community entry cannot use personal quick save or publish before review', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/request?destination=COMMUNITY')
  await page.locator('textarea').fill('Please check this')
  await expect(page.getByRole('button', { name: '개인 연습장에 저장', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '다음', exact: true }).click()
  expect(state.posts).toHaveLength(0)
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeVisible()
})

test('sent requests paginate, recover from failure and become friends after refresh', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/friends?invite=Mina')
  await expect(page.getByText('초대한 친구 · Mina')).toBeVisible()
  const sent = page.getByRole('region', { name: '보낸 친구 요청' })
  await expect(sent.getByText('Mina', { exact: true })).toBeVisible()
  await sent.getByRole('button', { name: '더 보기', exact: true }).click()
  await expect(sent.getByText('Alex', { exact: true })).toBeVisible()
  state.sentFailure = true
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(sent.getByRole('button', { name: /다시 시도/ })).toBeVisible()
  state.sentFailure = false; state.accepted = true
  await sent.getByRole('button', { name: /다시 시도/ }).click()
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(sent.getByText('수락을 기다리는 요청이 없습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '카드 열기', exact: true })).toBeVisible()
})

test('public preview plays without signup and offers feedback without microphone access', async ({ page }) => {
  const state = await fixture(page, true)
  await page.goto('/')
  const sample = page.locator('audio')
  await sample.evaluate(async (element: HTMLAudioElement) => { await element.play() })
  await expect.poll(() => sample.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0)
  await page.getByRole('button', { name: '피드백 예시 보기', exact: true }).click()
  await expect(page.getByText(/again에 강세/)).toBeVisible()
  await expect(page.getByRole('link', { name: '혼자 먼저 시작하기', exact: true })).toHaveAttribute('href', /redirect=/)
  expect(state.posts).toHaveLength(0)
})

test.describe('real service worker', () => {
  test.use({ serviceWorkers: 'allow' })
  test('direct login registers a worker and unseen offline navigation gives recovery guidance', async ({ page, context }) => {
    await page.goto('/login')
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await context.setOffline(true)
    try {
      await page.goto('/study/not-visited')
      await expect(page.getByRole('heading', { name: /You are offline/ })).toBeVisible()
    } finally { await context.setOffline(false) }
  })
})
