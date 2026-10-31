import { expect, test, type Page } from '@playwright/test'

test.use({ locale: 'en-US' })
function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}
async function fillAuth(page: Page, kind: 'login' | 'signup', email: string) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  if (kind === 'signup') await page.getByRole('textbox', { name: /^Username/ }).fill('fixture_user')
  await page.getByLabel(/^Password/).fill('Fixture1!')
  await page.getByRole('button', { name: kind === 'login' ? 'Log in' : 'Sign up', exact: true }).click()
}
const session = { id: 'shared', title: 'Together', memberIds: ['owner', 'friend'], createdBy: 'owner', status: 'ACTIVE', createdAt: '2026-10-29T00:00:00Z' }
const card = { id: 'created-card', sessionId: 'shared', createdByUserId: 'owner', phrase: 'Test', tags: [], position: 0, createdAt: session.createdAt }
function user(id: string) {
  return { id, username: id, uiLanguage: 'en', onboardingCompleted: true, nativeLanguage: 'ko', learningLanguages: ['en'], fluentLanguages: [], credits: 0 }
}
async function cookies(page: Page) {
  await page.context().addCookies([
    { name: 'session', value: '1', domain: '127.0.0.1', path: '/' },
    { name: 'tonebridge_ui_language', value: 'en', domain: '127.0.0.1', path: '/' },
  ])
}
for (const first of ['login', 'signup'] as const) {
  for (const second of ['login', 'signup'] as const) {
    test(`late ${first} cannot replace ${second} cookies or restore the old account`, async ({ page }) => {
      await cookies(page)
      const started = gate(), release = gate(), completed = gate()
      const reads: string[] = []
      await page.route('**/api/**', async (route) => {
        const req = route.request(), path = new URL(req.url()).pathname
        if (path === '/api/auth/login' || path === '/api/auth/register') {
          const old = req.postDataJSON().email === 'old@example.com'
          if (old) { started.release(); await release.promise }
          const token = old ? 'old-account' : 'new-account'
          try {
            await route.fulfill({ json: { accessToken: token }, headers: {
              'set-cookie': `refresh_token=${token}; Path=/api/auth; HttpOnly; SameSite=Lax`,
            } })
          } finally { if (old) completed.release() }
          return
        }
        if (path === '/api/auth/refresh') {
          const token = (req.headers().cookie ?? '').match(/refresh_token=([^;]+)/)?.[1]
          return route.fulfill({ status: token ? 200 : 401, json: { accessToken: token ?? 'none' } })
        }
        if (path === '/api/practice-feedback') return route.fulfill({ json: { items: [], nextPage: null } })
        if (path === '/api/users/me') {
          const id = req.headers().authorization?.replace('Bearer ', '') ?? ''
          reads.push(id)
          return route.fulfill({ json: user(id) })
        }
        return route.fulfill({ json: [] })
      })
      await page.goto('/' + first)
      await fillAuth(page, first, 'old@example.com')
      await started.promise
      await page.getByRole('link', { name: first === 'login' ? 'Sign up' : 'Log in', exact: true }).click()
      if (first === second) await page.getByRole('link', { name: second === 'login' ? 'Log in' : 'Sign up', exact: true }).click()
      await fillAuth(page, second, 'new@example.com')
      await expect(page).toHaveURL(/\/study$/)
      expect(reads).toContain('new-account')
      release.release()
      await completed.promise
      // Let Chromium process any Set-Cookie on the late response, including an aborted request.
      await page.waitForTimeout(150)
      const refresh = (await page.context().cookies()).find((c) => c.name === 'refresh_token')
      expect(refresh).toMatchObject({ value: 'new-account', httpOnly: true, path: '/api/auth' })
      const beforeReload = reads.length
      await page.reload()
      await expect.poll(() => reads.length).toBeGreaterThan(beforeReload)
      expect(reads.slice(beforeReload)).toEqual(['new-account'])
      await expect(page).toHaveURL(/\/study$/)
    })
  }
}

for (const switching of [true, false]) {
  for (const fails of [false, true]) {
    test(`request upload ${fails ? 'failure' : 'success'} ${switching ? 'after account switch has no writes or navigation' : 'in same account preserves save or cleanup'}`, async ({ page }) => {
      await cookies(page)
      let active = 'owner'
      const started = gate(), release = gate(), completed = gate()
      const writes: { path: string; method: string; authorization?: string }[] = []
      await page.route('**/api/**', async (route) => {
        const req = route.request(), path = new URL(req.url()).pathname
        if (req.method() !== 'GET') writes.push({ path, method: req.method(), authorization: req.headers().authorization })
        if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: active } })
        if (path === '/api/auth/login') { active = 'friend'; return route.fulfill({ json: { accessToken: active } }) }
        if (path === '/api/auth/logout') return route.fulfill({ json: {} })
        if (path === '/api/practice-feedback') return route.fulfill({ json: { items: [], nextPage: null } })
        if (path === '/api/users/me') return route.fulfill({ json: user(active) })
        if (path === '/api/users/me/profile') return route.fulfill({ json: {
          username: active, level: 'NATIVE', reputationScore: 0, streakDays: 0, badges: [], totalCorrections: 0,
          adoptedCorrections: 0, nativeLanguage: 'ko', fluentLanguages: [], learningLanguages: ['en'],
        } })
        if (path === '/api/friends') return route.fulfill({ json: [{ id: 'friend', username: 'Partner', nativeLanguage: 'en' }] })
        if (path === '/api/sessions') return route.fulfill({ json: [session] })
        if (path === '/api/sessions/shared') return route.fulfill({ json: session })
        if (path === '/api/sessions/shared/cards') return route.fulfill({ json: req.method() === 'POST' ? card : [] })
        if (path === '/api/cards/created-card') return route.fulfill({ json: card })
        if (path.endsWith('/upload-url')) return route.fulfill({ json: {
          uploadUrl: 'http://127.0.0.1:3100/held-put', audioKey: 'owner-recording.webm',
        } })
        return route.fulfill({ json: [] })
      })
      await page.route('**/held-put', async (route) => {
        started.release(); await release.promise
        await route.fulfill({ status: fails ? 503 : 200, body: '' }); completed.release()
      })
      await page.goto('/study')
      await page.getByRole('link', { name: /Ask community/ }).click()
      await page.getByRole('button', { name: 'Audio', exact: true }).click()
      await page.getByRole('button', { name: 'Start recording', exact: true }).click()
      await page.getByRole('button', { name: 'Start recording', exact: true }).last().click()
      await expect(page.getByRole('button', { name: 'Stop recording', exact: true }).last()).toBeVisible()
      await page.waitForTimeout(350)
      await page.getByRole('button', { name: 'Stop recording', exact: true }).last().click()
      await page.getByRole('button', { name: 'Close', exact: true }).click()
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await page.getByRole('button', { name: /Send to a friend/ }).click()
      await page.getByRole('combobox').selectOption('friend')
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await page.getByRole('button', { name: 'Send to a friend', exact: true }).click()
      await started.promise
      if (switching) {
        await page.goBack()
        page.once('dialog', (dialog) => dialog.accept())
        await page.getByRole('link', { name: 'Profile', exact: true }).click()
        await page.getByRole('button', { name: 'Settings', exact: true }).click()
        await page.getByRole('button', { name: /Log out/ }).click()
        await expect(page).toHaveURL(/\/login$/)
        await fillAuth(page, 'login', 'friend@example.com')
        await expect(page).toHaveURL(/\/study$/)
      }
      const writesBeforeRelease = writes.length
      release.release(); await completed.promise
      await page.waitForTimeout(250)
      const confirms = writes.filter((w) => w.path === '/api/cards/created-card/native-audios')
      const deletes = writes.filter((w) => w.method === 'DELETE')
      if (switching) {
        expect(writes.slice(writesBeforeRelease)).toEqual([])
        expect(confirms).toEqual([])
        expect(deletes).toEqual([])
        await expect(page).toHaveURL(/\/study$/)
      } else if (fails) {
        expect(confirms).toEqual([])
        expect(deletes).toEqual([{ path: '/api/cards/created-card', method: 'DELETE', authorization: 'Bearer owner' }])
        await expect(page).toHaveURL(/\/request\?destination=COMMUNITY$/)
        await expect(page.getByRole('button', { name: 'Send to a friend', exact: true })).toBeEnabled()
      } else {
        expect(confirms).toEqual([{ path: '/api/cards/created-card/native-audios', method: 'POST', authorization: 'Bearer owner' }])
        expect(deletes).toEqual([])
        await expect(page).toHaveURL(/\/study\/shared\/cards\/created-card$/)
      }
    })
  }
}
