import { expect, test, type Page } from '@playwright/test'

type ReportBody = { targetType: string; targetId: string; reason: string; detail?: string; alsoBlock: boolean }

async function app(page: Page, reply: { status: number; json: unknown } = { status: 201, json: { id: 'r-1' } }) {
  await page.context().addCookies([
    { name: 'session', value: 'fixture', domain: '127.0.0.1', path: '/' },
    { name: 'tonebridge_ui_language', value: 'ko', domain: '127.0.0.1', path: '/' },
  ])
  const me = { id: 'owner', username: 'learner', nativeLanguage: 'ko', uiLanguage: 'ko', fluentLanguages: [], learningLanguages: ['en'], onboardingCompleted: true }
  const friend = { id: 'peer', username: 'Mina', nativeLanguage: 'en' }
  const state = { reports: [] as ReportBody[] }
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: 'fixture' } })
    if (path === '/api/users/me' || path === '/api/users/me/profile') return route.fulfill({ json: { ...me, reputationScore: 5, correctorLevel: 'NATIVE', badges: [], totalCorrections: 0, correctionStreak: 0 } })
    if (path === '/api/reports' && request.method() === 'POST') {
      state.reports.push(request.postDataJSON() as ReportBody)
      return route.fulfill({ status: reply.status, json: reply.json })
    }
    if (path === '/api/users/me/blocks') return route.fulfill({ json: { items: [], nextPage: null } })
    if (path === '/api/friends') return route.fulfill({ json: [friend] })
    if (path === '/api/friends/sent') return route.fulfill({ json: { items: [], nextPage: null } })
    return route.fulfill({ json: [] })
  })
  return state
}

test('a friend is reported with a reason and trimmed detail', async ({ page }) => {
  const state = await app(page)
  await page.goto('/friends')
  await page.getByRole('button', { name: '신고', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '사용자 신고' })
  const submit = dialog.getByRole('button', { name: '신고 보내기', exact: true })
  await expect(submit).toBeDisabled()
  await dialog.getByLabel('괴롭힘 또는 따돌림').check()
  await dialog.getByLabel('자세한 내용 (선택)').fill('  keeps insulting me  ')
  await submit.click()
  await expect(dialog.getByRole('status')).toContainText('24시간')
  expect(state.reports).toEqual([{ targetType: 'USER', targetId: 'peer', reason: 'HARASSMENT', detail: 'keeps insulting me', alsoBlock: false }])
})

test('a refused report explains why and keeps the form', async ({ page }) => {
  await app(page, { status: 429, json: { code: 'REPORT_003', message: 'limit' } })
  await page.goto('/friends')
  await page.getByRole('button', { name: '신고', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '사용자 신고' })
  await dialog.getByLabel('스팸 또는 광고').check()
  await dialog.getByRole('button', { name: '신고 보내기', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('support@mungji.com')
  await expect(dialog.getByRole('button', { name: '신고 보내기', exact: true })).toBeEnabled()
})

test('reporting with block reloads the friend list', async ({ page }) => {
  const state = await app(page)
  await page.goto('/friends')
  await page.getByRole('button', { name: '신고', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '사용자 신고' })
  await dialog.getByLabel('혐오 표현').check()
  await dialog.getByLabel('이 사용자도 차단하기').check()
  await dialog.getByRole('button', { name: '신고 보내기', exact: true }).click()
  await expect.poll(() => state.reports.length).toBe(1)
  // The block closes shared notebooks, so the page reloads instead of showing the sent state.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/friends$/)
  expect(state.reports[0]).toMatchObject({ reason: 'HATE', alsoBlock: true })
  expect(state.reports[0]).not.toHaveProperty('detail')
})
