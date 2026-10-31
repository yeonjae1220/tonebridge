import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const cardPath = '/study/draft-session/cards/draft-card'
const databaseName = 'tonebridge-recording-drafts'
const runtimeErrors = new WeakMap<BrowserContext, string[]>()
test.beforeEach(({ context }) => {
  const errors: string[] = []
  runtimeErrors.set(context, errors)
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)))
})
test.afterEach(({ context }) => { expect(runtimeErrors.get(context)).toEqual([]) })
async function fixture(context: BrowserContext) {
  await context.addCookies([{ name: 'session', value: 'fixture', domain: '127.0.0.1', path: '/' }])
  const state = { owner: 'owner', audio: Buffer.alloc(0) as Buffer, puts: 0, presigns: 0, confirms: 0, failConfirm: false, saved: false }
  await context.route('**/api/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.startsWith('/api/auth/')) return route.fulfill({ json: { accessToken: state.owner } })
    if (path === '/api/users/me') return route.fulfill({ json: { id: state.owner, username: state.owner, onboardingCompleted: true, uiLanguage: 'ko', nativeLanguage: 'ko', fluentLanguages: [], learningLanguages: ['ja'] } })
    if (path === '/api/users/me/profile') return route.fulfill({ json: { username: state.owner, correctorLevel: 'NATIVE', reputationScore: 0, correctionStreak: 0, badges: [], nativeLanguage: 'ko', learningLanguages: ['ja'], fluentLanguages: [] } })
    if (path === '/api/cards/draft-card') return route.fulfill({ json: { id: 'draft-card', sessionId: 'draft-session', createdByUserId: 'owner', phrase: '復元', tags: [], position: 0, createdAt: '2026-10-31T00:00:00Z' } })
    if (path === '/api/practice-feedback') return route.fulfill({ json: { items: [], nextPage: null } })
    if (path.endsWith('/presigned-upload') || path.endsWith('/upload-url')) {
      state.presigns++
      return route.fulfill({ json: { audioKey: 'draft-audio.webm', uploadUrl: 'http://127.0.0.1:3100/draft-upload' } })
    }
    if (path.endsWith('/download-url')) return route.fulfill({ json: { downloadUrl: 'http://127.0.0.1:3100/draft-download' } })
    if (path.endsWith('/attempts')) {
      if (request.method() === 'POST') { state.confirms++; if (!state.failConfirm) state.saved = true }
      const attempt = { id: 'draft-attempt', cardId: 'draft-card', learnerId: 'owner', audioUrl: 'draft-audio.webm', attemptedAt: '2026-10-31T00:00:00Z', score: null, correctionNote: null }
      return route.fulfill({ status: request.method() === 'POST' && state.failConfirm ? 503 : 200,
        json: request.method() === 'POST' ? attempt : state.saved ? [attempt] : [] })
    }
    return route.fulfill({ json: [] })
  })
  await context.route('**/draft-upload', async (route) => {
    state.puts++; state.audio = route.request().postDataBuffer() ?? Buffer.alloc(0)
    await route.fulfill({ status: 200 })
  })
  await context.route('**/draft-download', (route) => route.fulfill({ contentType: 'audio/webm', body: state.audio }))
  return state
}
async function start(page: Page) {
  await page.locator('#recording-panel').getByRole('button', { name: '녹음 시작', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '녹음 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '녹음 중지', exact: true })).toBeVisible()
}
async function record(page: Page) {
  await start(page)
  await page.waitForTimeout(450)
  await page.getByRole('dialog').getByRole('button', { name: '녹음 중지', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('#recording-panel [data-testid="draft-notice"]')).toContainText('이 브라우저에 임시 저장했습니다')
}
async function digest(page: Page) {
  return page.locator('#recording-panel audio').evaluate(async (audio: HTMLAudioElement) => {
    const bytes = await (await fetch(audio.src)).arrayBuffer()
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
  })
}
async function play(page: Page, selector = '#recording-panel audio') {
  const audio = page.locator(selector).first()
  await audio.evaluate(async (element: HTMLAudioElement) => { await element.play() })
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0)
  expect(await audio.evaluate((element: HTMLAudioElement) => element.error)).toBeNull()
}
async function reload(page: Page) {
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload({ waitUntil: 'domcontentloaded' })
  page.removeAllListeners('dialog')
}
async function rows(page: Page) {
  return page.evaluate(async (name) => new Promise<{ scope: string; bytes: number; uploaded: boolean }[]>((resolve, reject) => {
    const request = indexedDB.open(name)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('drafts'), get = tx.objectStore('drafts').getAll()
      get.onsuccess = () => resolve(get.result.filter((r) => r.draft).map((r) => ({ scope: r.scope, bytes: r.draft.blob.size, uploaded: !!r.upload })))
      tx.oncomplete = () => db.close()
    }
  }), databaseName)
}

test('stopped draft survives reload and a closed tab, then saves and plays after another reload', async ({ page, context }, info) => {
  const state = await fixture(context)
  await page.goto(cardPath); await record(page)
  const original = await digest(page)
  await reload(page)
  await expect(page.locator('#recording-panel')).toContainText('미저장 녹음을 복구했습니다')
  expect(await digest(page)).toEqual(original)
  await play(page)
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto(cardPath)
  await expect(reopened.locator('#recording-panel')).toContainText('미저장 녹음을 복구했습니다')
  expect(await digest(reopened)).toEqual(original)
  await reopened.screenshot({ path: info.outputPath('recovered-recording.png'), fullPage: true })
  await reopened.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect.poll(() => rows(reopened)).toEqual([])
  expect(state.puts).toBe(1)
  await reload(reopened)
  await expect(reopened.locator('#recording-panel audio')).toHaveCount(0)
  await play(reopened, 'audio[aria-label]')
})

test('closing while recording recovers the last committed checkpoint', async ({ page, context }) => {
  await fixture(context)
  await page.goto(cardPath); await start(page)
  await expect.poll(() => rows(page)).not.toEqual([])
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto(cardPath)
  await expect(reopened.locator('#recording-panel')).toContainText('녹음이 중단되기 전 임시 보관된 부분')
  await play(reopened)
})

test('example and compose drafts reopen in the right recording view', async ({ page, context }) => {
  await fixture(context)
  await page.goto(cardPath)
  await page.getByRole('button', { name: '예시 발음 추가', exact: true }).click()
  await record(page); await reload(page)
  await expect(page.getByRole('button', { name: '예시 발음 추가', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#recording-panel')).toContainText('미저장 녹음을 복구했습니다')
  page.once('dialog', (dialog) => dialog.accept())
  await page.goto('/request?kind=AUDIO')
  await page.getByRole('dialog').getByRole('button', { name: '녹음 시작', exact: true }).click()
  await page.waitForTimeout(400)
  await page.getByRole('dialog').getByRole('button', { name: '녹음 중지', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByTestId('draft-notice')).toContainText('이 브라우저에 임시 저장했습니다')
  await reload(page)
  await expect(page.getByRole('dialog')).toContainText('미저장 녹음을 복구했습니다')
})

test('explicit discard stays discarded after reload and clears another open tab', async ({ page, context }) => {
  await fixture(context)
  await page.goto(cardPath); await record(page)
  const second = await context.newPage(); await second.goto(cardPath)
  await expect(second.locator('#recording-panel audio')).toHaveCount(1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '임시 녹음 버리기', exact: true }).click()
  await expect.poll(() => rows(page)).toEqual([])
  await expect(second.locator('#recording-panel audio')).toHaveCount(0)
  await reload(page)
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
})

test('logout purges persisted drafts including a second tab', async ({ page, context }) => {
  await fixture(context)
  await page.goto(cardPath); await record(page)
  const second = await context.newPage(); await second.goto(cardPath)
  await expect(second.locator('#recording-panel audio')).toHaveCount(1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('link', { name: '프로필', exact: true }).click()
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByRole('button', { name: /로그아웃/ }).click()
  await expect(page).toHaveURL(/\/login/)
  await expect.poll(() => rows(page)).toEqual([])
  await expect(second).toHaveURL(/\/login/)
})

test('another authenticated account cannot restore the previous account draft', async ({ page, context }) => {
  const state = await fixture(context)
  await page.goto(cardPath); await record(page)
  state.owner = 'another-account'
  await reload(page)
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
  await expect(page.locator('#recording-panel').getByRole('button', { name: '녹음 시작', exact: true })).toBeEnabled()
})

test('storage failure retains playable audio and offers download and retry', async ({ page, context }) => {
  await fixture(context)
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open
    IDBFactory.prototype.open = function (...args: Parameters<IDBFactory['open']>) {
      if (!(window as unknown as { storageAllowed?: boolean }).storageAllowed) throw new DOMException('Blocked', 'SecurityError')
      return original.apply(this, args)
    }
  })
  await page.goto(cardPath); await start(page)
  await page.waitForTimeout(350)
  await page.getByRole('button', { name: '녹음 중지', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('#recording-panel')).toContainText('임시 저장소를 사용할 수 없거나')
  await play(page)
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: '녹음 파일 내려받기' }).click()
  expect((await download).suggestedFilename()).toBe('recording.webm')
  await page.evaluate(() => Object.assign(window, { storageAllowed: true }))
  await page.getByRole('button', { name: '임시 저장 다시 시도' }).click()
  await expect(page.locator('#recording-panel')).toContainText('이 브라우저에 임시 저장했습니다')
  await reload(page)
  await expect(page.locator('#recording-panel')).toContainText('임시 저장소를 사용할 수 없거나')
})

test('retry after reload reuses the completed upload instead of creating a second recording', async ({ page, context }) => {
  const state = await fixture(context)
  state.failConfirm = true
  await page.goto(cardPath); await record(page)
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect(page.getByText('녹음을 제출하지 못했습니다. 다시 시도해주세요.')).toBeVisible()
  await expect.poll(async () => (await rows(page))[0]?.uploaded).toBe(true)
  await reload(page)
  await expect(page.locator('#recording-panel')).toContainText('미저장 녹음을 복구했습니다')
  state.failConfirm = false
  await page.getByRole('button', { name: '연습 녹음 저장', exact: true }).click()
  await expect.poll(() => rows(page)).toEqual([])
  expect(state.presigns).toBe(1); expect(state.puts).toBe(1); expect(state.confirms).toBe(2)
})

test('expired local audio is removed instead of silently restored', async ({ page, context }) => {
  await fixture(context)
  await page.goto(cardPath); await record(page)
  await page.evaluate(async (name) => new Promise<void>((resolve) => {
    const request = indexedDB.open(name)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts'), cursor = store.openCursor()
      cursor.onsuccess = () => {
        if (!cursor.result) return
        cursor.result.update({ ...cursor.result.value, updatedAt: Date.now() - 8 * 24 * 60 * 60_000 }); cursor.result.continue()
      }
      tx.oncomplete = () => { db.close(); resolve() }
    }
  }), databaseName)
  await reload(page)
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
  await expect.poll(() => rows(page)).toEqual([])
})

test('a quota failure keeps the live recording and recovers after storage becomes writable', async ({ page, context }) => {
  await fixture(context)
  await page.goto(cardPath)
  await expect(page.getByTestId('draft-notice')).toHaveCount(0)
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'drafts' && args[0]?.draft && !(window as unknown as { quotaAvailable?: boolean }).quotaAvailable) {
        throw new DOMException('Full', 'QuotaExceededError')
      }
      return put.apply(this, args)
    }
  })
  await start(page); await page.waitForTimeout(350)
  await page.getByRole('dialog').getByRole('button', { name: '녹음 중지', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('#recording-panel')).toContainText('임시 저장소를 사용할 수 없거나')
  const original = await digest(page)
  await play(page)
  await page.evaluate(() => Object.assign(window, { quotaAvailable: true }))
  await page.getByRole('button', { name: '임시 저장 다시 시도' }).click()
  await expect(page.locator('#recording-panel')).toContainText('이 브라우저에 임시 저장했습니다')
  await reload(page)
  await expect(page.locator('#recording-panel')).toContainText('미저장 녹음을 복구했습니다')
  expect(await digest(page)).toEqual(original)
})

test('logout revocation prevents recovery even when asynchronous storage cleanup fails', async ({ page, context }) => {
  await fixture(context)
  await page.goto(cardPath); await record(page)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('link', { name: '프로필', exact: true }).click()
  // A freshly loaded profile must know which account's drafts to revoke too.
  await expect(page).toHaveURL(/\/profile$/)
  await reload(page)
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.evaluate(() => { IDBFactory.prototype.open = () => { throw new DOMException('Offline store', 'SecurityError') } })
  await page.getByRole('button', { name: /로그아웃/ }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto(cardPath)
  await expect(page.getByTestId('draft-notice')).toHaveCount(0)
  await expect(page.locator('#recording-panel audio')).toHaveCount(0)
  await expect.poll(() => rows(page)).toEqual([])
})
