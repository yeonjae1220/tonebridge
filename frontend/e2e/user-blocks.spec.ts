import { expect, test, type Page, type Route } from '@playwright/test'

async function app(page: Page) {
  await page.context().addCookies([
    { name: 'session', value: 'fixture', domain: '127.0.0.1', path: '/' },
    { name: 'tonebridge_ui_language', value: 'ko', domain: '127.0.0.1', path: '/' },
  ])
  const me = { id: 'owner', username: 'learner', nativeLanguage: 'ko', uiLanguage: 'ko', fluentLanguages: [], learningLanguages: ['en'], onboardingCompleted: true }
  const friend = { id: 'peer', username: 'Mina', nativeLanguage: 'en' }
  const state = { blocked: false, writes: 0, hold: false, readFailure: false, holdReads: false, held: [] as Route[] }
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: 'fixture' } })
    if (path === '/api/users/me' || path === '/api/users/me/profile') return route.fulfill({ json: { ...me, reputationScore: 5, correctorLevel: 'NATIVE', badges: [], totalCorrections: 0, correctionStreak: 0 } })
    if (path === '/api/users/me/blocks/peer') {
      state.writes++
      if (state.hold) { state.held.push(route); return }
      state.blocked = request.method() === 'PUT'
      return route.fulfill({ status: 204 })
    }
    if (path === '/api/users/me/blocks') {
      if (state.holdReads) { state.held.push(route); return }
      return route.fulfill({ status: state.readFailure ? 503 : 200, json: { items: state.blocked ? [{ userId: 'peer', username: 'Mina', createdAt: new Date().toISOString() }] : [], nextPage: null } })
    }
    if (path === '/api/friends') return route.fulfill({ json: state.blocked ? [] : [friend] })
    if (path === '/api/friends/sent') return route.fulfill({ json: { items: [], nextPage: null } })
    return route.fulfill({ json: [] })
  })
  return state
}

test('confirmed block clears peer view and exposes the settings management route', async ({ page }) => {
  const state = await app(page)
  await page.goto('/friends')
  await page.getByRole('button', { name: '사용자 차단', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('기록은 보존')
  await dialog.getByRole('button', { name: '사용자 차단', exact: true }).click()
  await expect(page.getByRole('button', { name: '사용자 차단', exact: true })).toHaveCount(0)
  expect(state.writes).toBe(1)
  await page.goto('/profile/settings')
  await page.getByRole('link', { name: '차단한 사용자', exact: true }).click()
  await expect(page.getByRole('main')).toContainText('Mina')
})

test('block timeout unlocks confirmation without automatic resend and late completion cannot navigate another screen', async ({ page }) => {
  const state = await app(page); state.hold = true
  await page.goto('/friends'); await page.clock.install()
  await page.getByRole('button', { name: '사용자 차단', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '사용자 차단', exact: true }).click()
  await expect.poll(() => state.writes).toBe(1)
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(dialog.getByRole('alert')).toContainText('완료 여부')
  await expect(dialog.getByRole('button', { name: '사용자 차단', exact: true })).toBeEnabled()
  await page.clock.fastForward(60_000); expect(state.writes).toBe(1)
  await page.goto('/profile/blocked')
  await state.held[0].fulfill({ status: 204 }).catch(() => {})
  await expect(page).toHaveURL(/profile\/blocked$/)
})

test('confirmed unblock removes the entry while background reads stall', async ({ page }) => {
  const state = await app(page); state.blocked = true
  await page.goto('/profile/blocked')
  await page.getByRole('button', { name: '차단 해제', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('자동 복원되지 않습니다')
  state.holdReads = true
  await dialog.getByRole('button', { name: '차단 해제', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('main')).not.toContainText('Mina')
  expect(state.writes).toBe(1)
})

test('list failure is an error with read retry, not an empty block list', async ({ page }) => {
  const state = await app(page); state.blocked = true; state.readFailure = true
  await page.goto('/profile/blocked')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.getByText('차단한 사용자가 없습니다.')).toHaveCount(0)
  state.readFailure = false
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByRole('main')).toContainText('Mina')
  expect(state.writes).toBe(0)
})
