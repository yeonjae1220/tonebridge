import { expect, test, type Page } from '@playwright/test'
import { fixture } from './fixtures/community'

async function study(page: Page) {
  const base = await fixture(page)
  await page.route('**/api/cards/card**', route => {
    const path = new URL(route.request().url()).pathname
    const json = path.endsWith('/attempts')
      ? [{ id: 'attempt', cardId: 'card', learnerId: 'owner', audioUrl: 'private-attempt.wav', attemptedAt: '2026-11-17T00:00:00Z' }]
      : path.endsWith('/native-audios')
        ? [{ id: 'example', audioKey: 'private-example.wav', createdAt: '2026-11-17T00:00:00Z' }]
        : { id: 'card', sessionId: 'session-1', phrase: 'Recovery practice', tags: [], createdByUserId: 'owner' }
    return route.fulfill({ json })
  })
  await page.route('**/api/**/download-url', route => route.fulfill({ json: { downloadUrl: 'http://127.0.0.1:3100/flow-audio.wav' } }))
  return base
}

for (const failure of ['timeout', 'network']) test(`support ${failure} retains input and does not resend or claim failure`, async ({ page }) => {
  await fixture(page)
  let writes = 0, release: (() => Promise<void>) | undefined
  await page.route('**/api/feedback', route => {
    writes++
    if (writes > 1) return route.fulfill({ json: { ok: true } })
    if (failure === 'network') return route.abort('failed')
    release = () => route.fulfill({ json: { ok: true } }).catch(() => {})
  })
  await page.goto('/help')
  const message = page.getByRole('textbox', { name: '문의 내용' })
  const email = page.getByRole('textbox', { name: '답변받을 이메일 (선택)' })
  await message.fill('Retain this support message'); await email.fill('fixture@example.test')
  await page.clock.install()
  await page.getByRole('button', { name: '문의 보내기' }).click()
  await expect.poll(() => writes).toBe(1)
  if (failure === 'timeout') { await expect(message).toBeDisabled(); await page.clock.fastForward(30_001) }
  await expect(page.locator('form').getByRole('alert')).toContainText('접수 여부')
  await expect(message).toBeEnabled(); await expect(email).toHaveValue('fixture@example.test')
  await expect(message).toHaveValue('Retain this support message')
  await message.fill('Newer support message')
  await release?.(); await page.clock.fastForward(60_000)
  await expect(message).toHaveValue('Newer support message'); expect(writes).toBe(1)
  await page.getByRole('button', { name: '문의 보내기' }).click()
  await expect(page.locator('form').getByRole('status')).toContainText('문의를 보냈습니다')
  expect(writes).toBe(2); await expect(message).toHaveValue('')
})

test('community audio lookup timeout offers a working retry', async ({ page }) => {
  const base = await fixture(page); base.request.type = 'AUDIO'
  let reads = 0
  await page.route('**/api/storage/presigned-download**', route => {
    reads++
    if (reads > 1) return route.fallback()
  })
  await page.clock.install(); await page.goto('/result/request-1')
  await expect.poll(() => reads).toBe(1); await page.clock.fastForward(15_001)
  const alert = page.getByRole('main').getByRole('alert')
  await expect(alert).toBeVisible()
  await alert.getByRole('button', { name: '다시 시도' }).click()
  await expect.poll(() => reads).toBe(2)
  await expect(alert).toHaveCount(0)
})

test('audio lookup failures do not log bearer credentials or private object keys', async ({ page }) => {
  const base = await fixture(page); base.request.type = 'AUDIO'; base.request.audioUrl = 'private-audio-secret.wav'
  base.fail.add('GET /api/storage/presigned-download')
  await page.addInitScript(() => {
    const logs: string[] = []; (window as unknown as { capturedLogs: string[] }).capturedLogs = logs
    const original = console.error
    console.error = (...args) => { logs.push(JSON.stringify(args)); original(...args) }
  })
  await page.goto('/result/request-1')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  const logs = await page.evaluate(() => (window as unknown as { capturedLogs: string[] }).capturedLogs.join('\n'))
  expect(logs).not.toContain('Bearer fixture'); expect(logs).not.toContain('private-audio-secret.wav')
})

for (const kind of ['attempt', 'example']) test(`study ${kind} audio lookup timeout recovers through retry`, async ({ page }) => {
  await study(page)
  let reads = 0
  const endpoint = kind === 'attempt' ? '/api/attempts/attempt/download-url' : '/api/native-audios/example/download-url'
  await page.route('**' + endpoint, route => { reads++; if (reads > 1) return route.fallback() })
  await page.clock.install(); await page.goto('/study/session-1/cards/card')
  await expect.poll(() => reads).toBe(1); await page.clock.fastForward(15_001)
  const alert = page.getByRole('main').getByRole('alert')
  await expect(alert).toBeVisible(); await alert.getByRole('button', { name: '다시 시도' }).click()
  await expect.poll(() => reads).toBe(2); await expect(alert).toHaveCount(0)
  const players = page.locator('audio[src$="flow-audio.wav"]')
  await expect(players).toHaveCount(2)
  for (const player of await players.all()) {
    await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.readyState)).toBeGreaterThan(0)
    expect(await player.evaluate(async (audio: HTMLAudioElement) => { await audio.play(); const playing = !audio.paused; audio.pause(); return playing })).toBe(true)
  }
})

test('practice user lookup failure offers retry without enabling recording prematurely', async ({ page }) => {
  const base = await study(page); base.fail.add('GET /api/users/me')
  await page.goto('/study/session-1/cards/card')
  await expect(page.getByText('Recovery practice', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '녹음 시작', exact: true })).toHaveCount(0)
  const alert = page.getByRole('main').getByRole('alert')
  await expect(alert).toBeVisible()
  base.fail.delete('GET /api/users/me')
  await alert.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByRole('button', { name: '녹음 시작', exact: true })).toBeEnabled()
})


for (const status of [500, 503, 504]) test(`review: support HTTP ${status} does not claim definite delivery failure`, async ({ page }) => {
  await fixture(page)
  let writes = 0
  await page.route('**/api/feedback', route => { writes++; return route.fulfill({ status, json: { ok: false } }) })
  await page.goto('/help')
  const message = page.getByRole('textbox', { name: '문의 내용' })
  await message.fill('Keep my uncertain support message')
  await page.getByRole('button', { name: '문의 보내기' }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('접수 여부')
  await expect(message).toHaveValue('Keep my uncertain support message')
  await expect(message).toBeEnabled(); expect(writes).toBe(1)
})

for (const status of [400, 429]) test(`review: support HTTP ${status} retains the definite rejection state`, async ({ page }) => {
  await fixture(page)
  await page.route('**/api/feedback', route => route.fulfill({ status, json: { ok: false } }))
  await page.goto('/help')
  await page.getByRole('textbox', { name: '문의 내용' }).fill('Retain rejected message')
  await page.getByRole('button', { name: '문의 보내기' }).click()
  await expect(page.locator('form').getByRole('alert')).toContainText('보내지 못했습니다')
})

test('review: stalled study media download times out and retries through authorization', async ({ page }) => {
  await study(page)
  let media = 0, lookups = 0, stalled = true
  await page.route('**/api/attempts/attempt/download-url', route => { lookups++; return route.fallback() })
  await page.route('**/flow-audio.wav', route => { media++; if (!stalled) return route.fallback() })
  await page.clock.install(); await page.goto('/study/session-1/cards/card')
  await expect.poll(() => media).toBeGreaterThan(0)
  await page.clock.fastForward(30_001)
  const item = page.locator('#attempt-attempt')
  await expect(item.getByRole('alert')).toBeVisible()
  stalled = false
  await item.getByRole('button', { name: '다시 시도' }).click()
  await expect.poll(() => lookups).toBe(2)
  await expect.poll(() => item.locator('audio').evaluate((audio: HTMLAudioElement) => audio.readyState)).toBeGreaterThan(0)
  expect(await item.locator('audio').evaluate(async (audio: HTMLAudioElement) => { await audio.play(); const playing = !audio.paused; audio.pause(); return playing })).toBe(true)
})

test('review: returning to study does not replace the active audio player', async ({ page }) => {
  await study(page)
  let lookups = 0
  await page.route('**/api/attempts/attempt/download-url', route => {
    lookups++
    return route.fulfill({ json: { downloadUrl: 'http://127.0.0.1:3100/flow-audio.wav#signature-' + lookups } })
  })
  await page.goto('/study/session-1/cards/card')
  const audio = page.locator('#attempt-attempt audio')
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.readyState)).toBeGreaterThan(0)
  await audio.evaluate(element => element.setAttribute('data-original-player', 'true'))
  await page.clock.install(); await page.clock.fastForward(2_000)
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')) })
  // A loaded, paused player must not time out merely because it is idle.
  await page.clock.fastForward(31_000)
  await expect(audio).toHaveAttribute('data-original-player', 'true')
  expect(lookups).toBe(1)
})
