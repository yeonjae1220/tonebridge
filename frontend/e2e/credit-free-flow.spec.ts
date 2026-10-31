import { expect, test, type Page } from '@playwright/test'
import { messages, SUPPORTED_UI_LANGUAGES } from '../src/i18n/messages'

test.use({ locale: 'en-US' })

async function mockApp(page: Page, loggedIn = true, onboarded = true, partnerUsername = 'partner') {
  const state = { loggedIn, onboarded, searches: [] as string[], writes: [] as { path: string; body: Record<string, unknown> }[] }
  const session = { id: 'shared', title: 'Together', memberIds: ['me', 'friend'], createdBy: 'me', status: 'ACTIVE', createdAt: '2026-10-29T00:00:00Z' }
  await page.context().addCookies(['127.0.0.1', 'localhost'].map((domain) => ({ name: 'tonebridge_ui_language', value: 'en', domain, path: '/' })))
  if (loggedIn) await page.context().addCookies(['127.0.0.1', 'localhost'].map((domain) => ({ name: 'session', value: 'test', domain, path: '/' })))
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (path === '/api/auth/refresh') return route.fulfill({ status: state.loggedIn ? 200 : 401, json: { accessToken: 'test' } })
    if (path === '/api/auth/login' || path === '/api/auth/register') {
      state.loggedIn = true
      await page.context().addCookies(['127.0.0.1', 'localhost'].map((domain) => ({ name: 'session', value: 'test', domain, path: '/' })))
      return route.fulfill({ json: { accessToken: 'test' } })
    }
    if (req.method() !== 'GET') {
      state.writes.push({ path, body: req.postDataJSON() ?? {} })
      if (path === '/api/users/me/onboarding') state.onboarded = true
      return route.fulfill({ status: 200, json: {} })
    }
    if (path === '/api/practice-feedback') return route.fulfill({ json: { items: [], nextPage: null } })
    if (path === '/api/users/me') return route.fulfill({ json: {
      id: 'me', username: 'learner', uiLanguage: 'en', credits: 0, nativeLanguage: 'ko',
      fluentLanguages: [], learningLanguages: ['en'], onboardingCompleted: state.onboarded,
    } })
    if (path === '/api/users/search') {
      state.searches.push(new URL(req.url()).searchParams.get('q') ?? '')
      return route.fulfill({ json: [{ id: 'friend', username: partnerUsername, nativeLanguage: 'en' }] })
    }
    if (path === '/api/friends') return route.fulfill({ json: [] })
    if (path === '/api/sessions') return route.fulfill({ json: [session] })
    if (path === '/api/sessions/shared') return route.fulfill({ json: session })
    return route.fulfill({ json: [] })
  })
  return state
}

test('invitation survives login and only sends a request after an explicit click', async ({ page }) => {
  const state = await mockApp(page, false)
  await page.goto('/friends?invite=partner')
  await expect(page).toHaveURL(/login.*redirect=/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/friends?invite=partner')
  await page.getByLabel('Email', { exact: true }).fill('learner@example.com')
  await page.getByLabel(/^Password/).fill('Password1!')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL(/friends\?invite=partner/)
  await expect(page.getByRole('button', { name: 'Request', exact: true })).toBeVisible()
  expect(state.writes).toEqual([])
  await page.getByRole('button', { name: 'Request', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Request sent')
  expect(state.writes).toEqual([{ path: '/api/friends/request', body: { receiverUsername: 'partner' } }])
})

test('signup keeps invitation through onboarding before asking to connect', async ({ page }) => {
  const state = await mockApp(page, false, false)
  await page.goto('/friends?invite=partner')
  await page.getByRole('link', { name: 'Sign up', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('new@example.com')
  await page.getByRole('textbox', { name: /^Username/ }).fill('new_learner')
  await page.getByLabel(/^Password/).fill('Password1!')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await expect(page).toHaveURL(/onboarding/)
  expect(await page.evaluate(() => sessionStorage.getItem('auth_redirect'))).toBe('/friends?invite=partner')
  await page.getByRole('button', { name: /English/ }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: /Korean/ }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page).toHaveURL(/friends\?invite=partner/)
  expect(state.writes.filter((write) => write.path === '/api/friends/request')).toEqual([])
  expect(await page.evaluate(() => sessionStorage.getItem('auth_redirect'))).toBeNull()
})

test('friend home and old wallet links lead to free practice', async ({ page }, testInfo) => {
  await mockApp(page)
  await page.goto('/wallet')
  await expect(page).toHaveURL(/study$/)
  await expect(page.getByRole('heading', { name: 'Practice with Friends' })).toBeVisible()
  await expect(page.getByText(/credits|wallet|30 credits/i)).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('friend-home.png'), fullPage: true })
  await page.getByRole('button', { name: 'Together', exact: true }).first().click()
  await expect(page).toHaveURL(/study\/shared/)
})

test('community entry retains its public destination without a credit cost', async ({ page }) => {
  await mockApp(page)
  await page.goto('/request?destination=COMMUNITY')
  await page.getByPlaceholder('Enter the sentence you want corrected...').fill('Please help me practise this phrase.')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  const community = page.getByRole('button', { name: /community/i })
  await expect(community).toHaveClass(/border-blue-300/)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText(/credits|balance/i)).toHaveCount(0)
})


test('public entry copy in all nine languages makes no currency promise', () => {
  const keys = ['landing.heroSubtitle', 'landing.startFree', 'landing.bottomSubtitle', 'login.welcome', 'feed.subtitle', 'feed.guestSubtitle'] as const
  for (const language of SUPPORTED_UI_LANGUAGES) {
    for (const key of keys) {
      expect(messages[language][key]).not.toMatch(/크레딧|credit|crédit|crédito|クレジット|积分|кредит|30/i)
    }
  }
})

test('post-auth redirect refuses a backslash host escape', async ({ page }) => {
  await mockApp(page, false)
  const unsafe = '/' + String.fromCharCode(92) + 'outside.example'
  await page.goto('/login?redirect=' + encodeURIComponent(unsafe))
  await page.getByLabel('Email', { exact: true }).fill('learner@example.com')
  await page.getByLabel(/^Password/).fill('Password1!')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL(/study$/)
  expect(['127.0.0.1', 'localhost']).toContain(new URL(page.url()).hostname)
})


for (const username of ['longgoogleuser_12345678', 'a'.repeat(41) + '_12345678']) {
  test('existing Google invitation survives login: ' + username.length + ' characters', async ({ page }) => {
    const state = await mockApp(page, false, true, username)
    await page.goto('/friends?invite=' + encodeURIComponent(username))
    await page.getByLabel('Email', { exact: true }).fill('learner@example.com')
    await page.getByLabel(/^Password/).fill('Password1!')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page).toHaveURL(new RegExp('friends\\?invite=' + username))
    const request = page.getByRole('button', { name: 'Request', exact: true })
    await expect(request).toBeVisible()
    await expect(request).toBeInViewport()
    expect(state.searches).toContain(username)
    expect(state.writes).toEqual([])
    await request.click()
    await expect(page.getByRole('status')).toContainText('Request sent')
    expect(state.writes).toEqual([{ path: '/api/friends/request', body: { receiverUsername: username } }])
  })
}

test('invalid and overlong invitations never trigger a user search or request', async ({ page }) => {
  const state = await mockApp(page)
  for (const username of ['a'.repeat(51), 'bad/name', 'bad<name>']) {
    await page.goto('/friends?invite=' + encodeURIComponent(username))
    await expect(page.getByRole('heading', { name: 'Friends', exact: true, level: 1 })).toBeVisible()
    // Wait beyond the 300ms search debounce to observe unwanted requests.
    await page.waitForTimeout(500)
    expect(state.searches).toEqual([])
    expect(state.writes).toEqual([])
    await expect(page.getByRole('button', { name: 'Request', exact: true })).toHaveCount(0)
  }
})
