import { expect, test, type Page, type Route } from '@playwright/test'

type Job = { id: string; state: string; includeAudio: boolean; createdAt: string; expiresAt: string; byteSize: number; failureCode: null }
const ready = (id = '11111111-1111-4111-8111-111111111111'): Job => ({ id, state: 'READY', includeAudio: false, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), byteSize: 123, failureCode: null })
async function app(page: Page) {
  await page.context().addCookies([{ name: 'session', value: 'export-test', domain: '127.0.0.1', path: '/' }, { name: 'tonebridge_ui_language', value: 'ko', domain: '127.0.0.1', path: '/' }])
  const state = { jobs: [] as Job[], writes: [] as { operationId: string; includeAudio: boolean }[], hold: false, acceptHeld: false, holdDownload: false, downloadStatus: 200, downloads: 0, readStatus: 200, createStatus: 202, held: [] as Route[] }
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: 'export-fixture' } })
    if (path === '/api/users/me' || path === '/api/users/me/profile') return route.fulfill({ json: { id: 'owner', email: 'fixture@example.test', username: 'learner', nativeLanguage: 'ko', uiLanguage: 'ko', fluentLanguages: [], learningLanguages: ['en'], onboardingCompleted: true, reputationScore: 5, correctorLevel: 'NATIVE', badges: [], correctionStreak: 0 } })
    if (path.endsWith('/download')) {
      state.downloads++
      if (state.holdDownload) { state.held.push(route); return }
      return state.downloadStatus === 200 ? route.fulfill({ contentType: 'application/zip', body: Buffer.from('fixture-zip') }) : route.fulfill({ status: state.downloadStatus, json: { code: 'EXPORT_002' } })
    }
    if (path === '/api/users/me/exports') {
      if (request.method() === 'GET') return route.fulfill({ status: state.readStatus, json: state.readStatus === 200 ? state.jobs : {} })
      const input = request.postDataJSON() as { operationId: string; includeAudio: boolean }; state.writes.push(input)
      if (state.createStatus !== 202) return route.fulfill({ status: state.createStatus, json: {} })
      const job = { ...ready(input.operationId), includeAudio: input.includeAudio, state: 'QUEUED' }
      if ((!state.hold || state.acceptHeld) && !state.jobs.some(row => row.id === job.id)) state.jobs.unshift(job)
      if (state.hold) { state.held.push(route); return }
      return route.fulfill({ status: 202, json: job })
    }
    return route.fulfill({ json: [] })
  })
  return state
}

test('prepare, poll and download a record archive without duplicate preparation', async ({ page }) => {
  const state = await app(page)
  await page.goto('/profile/settings')
  await page.getByRole('link', { name: '내 기록 내보내기', exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '내보내기 준비', exact: true }).click()
  await expect(page.getByText('대기 중', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '내보내기 준비', exact: true })).toBeDisabled()
  expect(state.writes).toHaveLength(1); expect(state.writes[0].includeAudio).toBe(true)
  state.jobs[0].state = 'READY'
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ZIP 다운로드', exact: true }).click()
  expect((await downloaded).suggestedFilename()).toBe('tonebridge-export-' + state.jobs[0].id + '.zip')
  expect(state.writes).toHaveLength(1)
})

test('uncertain accepted preparation resolves by reading without resending', async ({ page }) => {
  const state = await app(page); state.hold = true; state.acceptHeld = true
  await page.goto('/profile/export'); await page.clock.install()
  await page.getByRole('button', { name: '내보내기 준비', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await expect(page.getByRole('checkbox')).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert')).toContainText('완료 여부')
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(page.getByText('대기 중', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '내보내기 준비', exact: true })).toBeDisabled()
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1)
})

test('reload after unknown preparation keeps the same operation for explicit retry', async ({ page }) => {
  const state = await app(page); state.hold = true
  await page.goto('/profile/export'); await page.clock.install()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '내보내기 준비', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await expect(page.getByRole('checkbox')).toBeDisabled()
  state.hold = false
  await page.getByRole('button', { name: '내보내기 준비', exact: true }).click()
  await expect(page.getByText('대기 중', { exact: true })).toBeVisible()
  expect(state.writes).toHaveLength(2); expect(state.writes[1]).toEqual(state.writes[0]); expect(state.jobs).toHaveLength(1)
})

test('revoked download shows recovery and does not create another archive', async ({ page }) => {
  const state = await app(page); state.jobs = [ready()]; state.downloadStatus = 409
  await page.goto('/profile/export')
  await page.getByRole('button', { name: 'ZIP 다운로드', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('접근 권한')
  await expect(page.getByRole('button', { name: 'ZIP 다운로드', exact: true })).toBeEnabled()
  expect(state.writes).toHaveLength(0)
})

test('leaving a pending download cancels it and cannot save a late file', async ({ page }) => {
  const state = await app(page); state.jobs = [ready()]; state.holdDownload = true
  let downloads = 0; page.on('download', () => downloads++)
  await page.goto('/profile/export')
  await page.getByRole('button', { name: 'ZIP 다운로드', exact: true }).click()
  await expect.poll(() => state.downloads).toBe(1)
  await page.goto('/help')
  await state.held[0].fulfill({ contentType: 'application/zip', body: Buffer.from('late') }).catch(() => {})
  await expect(page).toHaveURL(/help$/); expect(downloads).toBe(0); expect(state.writes).toHaveLength(0)
})

test('list failure exposes read retry and definite rate rejection unlocks audio choice', async ({ page }) => {
  const state = await app(page); state.readStatus = 503
  await page.goto('/profile/export')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.getByText('아직 내보내기 기록이 없습니다.')).toHaveCount(0)
  state.readStatus = 200
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByText('아직 내보내기 기록이 없습니다.')).toBeVisible()
  state.createStatus = 429
  await page.getByRole('button', { name: '내보내기 준비', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('시간당 최대 2회')
  await expect(page.getByRole('checkbox')).toBeEnabled(); expect(state.writes).toHaveLength(1)
})
