import { expect, test, type Page, type Route } from '@playwright/test'

async function app(page: Page, guest = false) {
  await page.context().addCookies([
    { name: 'tonebridge_ui_language', value: 'ko', domain: '127.0.0.1', path: '/' },
    { name: 'session', value: 'entry-test', domain: '127.0.0.1', path: '/' },
  ])
  const user = { id: 'entry-user', username: 'learner', nativeLanguage: 'ko', uiLanguage: 'ko',
    learningLanguages: ['ja'], fluentLanguages: [], onboardingCompleted: false }
  const state = { guest, user, failRead: false, holdRead: false, holdWrite: false, holdRefresh: false,
    reads: 0, authWrites: 0, refreshes: 0, writes: [] as Record<string, unknown>[], held: [] as Route[] }
  await page.route('**/api/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (path === '/api/auth/refresh') {
      state.refreshes++
      if (state.holdRefresh) { state.held.push(route); return }
      return route.fulfill({ status: state.guest ? 401 : 200, json: { accessToken: 'entry-token' } })
    }
    if (path === '/api/auth/login' || path === '/api/auth/register') {
      state.authWrites++
      if (state.holdWrite) { state.held.push(route); return }
      state.guest = false
      return route.fulfill({ json: { accessToken: 'entry-token' } })
    }
    if (path === '/api/users/me/onboarding') {
      state.writes.push(req.postDataJSON())
      if (state.holdWrite) { state.held.push(route); return }
      Object.assign(user, req.postDataJSON(), { onboardingCompleted: true })
      return route.fulfill({ json: user })
    }
    if (path === '/api/users/me') {
      state.reads++
      if (state.holdRead) { state.held.push(route); return }
      return route.fulfill({ status: state.failRead ? 503 : 200, json: user })
    }
    if (path === '/api/practice-feedback' || path === '/api/friends/sent') return route.fulfill({ json: { items: [], nextPage: null } })
    if (path === '/api/languages/variants') return route.fulfill({ json: {} })
    return route.fulfill({ json: [] })
  })
  return state
}
async function credentials(page: Page, signup = false) {
  await page.getByLabel('이메일', { exact: true }).fill('entry@example.test')
  await page.getByLabel('비밀번호', { exact: true }).fill('ValidPass123!')
  if (signup) await page.getByLabel('닉네임', { exact: true }).fill('entry_user')
  await page.getByRole('button', { name: signup ? '가입하기' : '로그인', exact: true }).click()
}
async function languages(page: Page) {
  await page.goto('/onboarding')
  await page.getByRole('button', { name: /한국어/ }).click()
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByRole('button', { name: /일본어/ }).first().click()
  await page.locator('summary').click()
  await page.locator('#onboarding-username').fill('new_name')
}

for (const signup of [false, true]) test(`${signup ? 'signup' : 'login'} retries failed destination reads without repeating authentication or losing invitation`, async ({ page }) => {
  const state = await app(page, true); state.failRead = true; state.user.onboardingCompleted = !signup
  await page.addInitScript(() => sessionStorage.setItem('auth_redirect', '/friends?invite=Mina'))
  await page.goto(signup ? '/signup' : '/login'); await credentials(page, signup)
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(signup ? /signup$/ : /login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('auth_redirect'))).toBe('/friends?invite=Mina')
  state.failRead = false
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page).toHaveURL(signup ? /onboarding$/ : /friends\?invite=Mina$/)
  expect(state.authWrites).toBe(1); expect(state.writes).toHaveLength(0)
})

test('startup refresh deadline reveals login and late refresh cannot overwrite explicit login', async ({ page }) => {
  const state = await app(page, true); state.holdRefresh = true; state.user.onboardingCompleted = true
  await page.clock.install(); await page.goto('/login')
  await expect.poll(() => state.refreshes).toBe(1)
  await expect(page.getByRole('status')).toBeVisible()
  await page.clock.fastForward(15_001)
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible()
  await credentials(page); await expect(page).toHaveURL(/study$/)
  await state.held[0].fulfill({ json: { accessToken: 'obsolete' } }).catch(() => {})
  await expect(page).toHaveURL(/study$/); expect(state.authWrites).toBe(1)
})

for (const signup of [false, true]) test(`${signup ? 'signup' : 'login'} deadline restores input and never resends authentication automatically`, async ({ page }) => {
  const state = await app(page, true); state.holdWrite = true
  await page.goto(signup ? '/signup' : '/login'); await page.clock.install(); await credentials(page, signup)
  await expect.poll(() => state.authWrites).toBe(1)
  await expect(page.getByLabel('이메일', { exact: true })).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: signup ? '가입하기' : '로그인', exact: true })).toBeEnabled()
  await expect(page.getByLabel('이메일', { exact: true })).toHaveValue('entry@example.test')
  await page.clock.fastForward(60_000); expect(state.authWrites).toBe(1)
})

test('destination read deadline offers read retry rather than editable onboarding', async ({ page }) => {
  const state = await app(page, true); state.holdRead = true; state.user.onboardingCompleted = true
  await page.goto('/login'); await page.clock.install(); await credentials(page)
  await expect.poll(() => state.reads).toBeGreaterThan(0)
  await page.clock.fastForward(15_001)
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled()
  state.holdRead = false; await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page).toHaveURL(/study$/); expect(state.authWrites).toBe(1)
})

test('onboarding timeout retains and unlocks all input, read recovery detects completed save without replay', async ({ page }) => {
  const state = await app(page); state.holdWrite = true
  await languages(page); await page.clock.install()
  await page.getByRole('button', { name: '시작하기', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await expect(page.locator('#onboarding-username')).toBeDisabled()
  await expect(page.getByRole('button', { name: /일본어/ }).first()).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert')).toContainText('완료 여부')
  await expect(page.locator('#onboarding-username')).toHaveValue('new_name')
  await expect(page.locator('#onboarding-username')).toBeEnabled()
  await expect(page.getByRole('button', { name: /일본어/ }).first()).toHaveClass(/border-blue-500/)
  state.user.onboardingCompleted = true
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(page).toHaveURL(/study$/); expect(state.writes).toHaveLength(1)
})

test('completed users cannot overwrite their profile through onboarding after a read failure', async ({ page }) => {
  const state = await app(page); state.user.onboardingCompleted = true; state.failRead = true
  await page.goto('/onboarding')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: /한국어/ })).toHaveCount(0)
  state.failRead = false; await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page).toHaveURL(/study$/); expect(state.writes).toHaveLength(0)
})

test('successful onboarding navigates while later reads stall and preserves invitation', async ({ page }) => {
  const state = await app(page)
  await page.addInitScript(() => sessionStorage.setItem('auth_redirect', '/friends?invite=Mina'))
  await languages(page); state.holdRead = true
  await page.getByRole('button', { name: '시작하기', exact: true }).click()
  await expect(page).toHaveURL(/friends\?invite=Mina$/); expect(state.writes).toHaveLength(1)
})

test('OAuth continuation removes the token fragment and recovers read failure without signing in again', async ({ page }) => {
  const state = await app(page, true); state.user.onboardingCompleted = true; state.failRead = true
  await page.addInitScript(() => sessionStorage.setItem('auth_redirect', '/friends?invite=Mina'))
  await page.goto('/auth/callback#token=fixture.payload.signature')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/auth\/callback$/)
  state.failRead = false; await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page).toHaveURL(/friends\?invite=Mina$/); expect(state.authWrites).toBe(0)
})


test('leaving a pending destination read preserves the invitation and ignores late navigation', async ({ page }) => {
  const state = await app(page, true); state.user.onboardingCompleted = true
  await page.goto('/community'); await page.getByRole('button', { name: '로그인하기', exact: true }).click()
  await page.evaluate(() => sessionStorage.setItem('auth_redirect', '/friends?invite=Mina'))
  state.holdRead = true; await credentials(page)
  await expect.poll(() => state.held.length).toBeGreaterThan(0)
  await expect(page.getByRole('status')).toBeVisible()
  await page.goBack(); await expect(page).toHaveURL(/community$/)
  state.holdRead = false
  for (const route of state.held) await route.fulfill({ json: state.user }).catch(() => {})
  await expect(page.waitForURL(/\/feed$/, { timeout: 1000 })).rejects.toThrow()
  expect(await page.evaluate(() => sessionStorage.getItem('auth_redirect'))).toBe('/feed')
})

test('late onboarding completion cannot navigate after going back to community', async ({ page }) => {
  const state = await app(page, true)
  await page.goto('/community'); await page.getByRole('button', { name: '로그인하기', exact: true }).click()
  await credentials(page); await expect(page).toHaveURL(/onboarding$/)
  await page.getByRole('button', { name: /한국어/ }).click()
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByRole('button', { name: /일본어/ }).first().click()
  state.holdWrite = true
  await page.getByRole('button', { name: '시작하기', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await page.goBack(); await expect(page).toHaveURL(/community$/)
  await state.held[0].fulfill({ json: { ...state.user, onboardingCompleted: true } })
  await expect(page.waitForURL(/\/feed$/, { timeout: 1000 })).rejects.toThrow()
  expect(await page.evaluate(() => sessionStorage.getItem('auth_redirect'))).toBe('/feed')
})


for (const signedOut of [false, true]) test(`draft entry keeps its destination with ${signedOut ? 'local signout' : 'no session hint'}`, async ({ page }) => {
  if (signedOut) await page.context().addCookies([
    { name: 'session', value: 'public-hint', domain: '127.0.0.1', path: '/' },
    { name: 'tonebridge_signed_out', value: '1', domain: '127.0.0.1', path: '/' },
  ])
  const response = await page.request.get('/drafts?from=shortcut', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  const target = new URL(response.headers().location, 'http://127.0.0.1:3100')
  expect(target.pathname).toBe('/login')
  expect(target.searchParams.get('redirect')).toBe('/drafts?from=shortcut')
})

test('expired session hint preserves the draft destination through explicit login', async ({ page }) => {
  const state = await app(page, true); state.user.onboardingCompleted = true
  await page.goto('/drafts?from=shortcut')
  await expect(page.getByLabel('이메일', { exact: true })).toBeVisible()
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/drafts?from=shortcut')
  await credentials(page)
  await expect(page).toHaveURL(/drafts\?from=shortcut$/)
  expect(state.authWrites).toBe(1)
})
