import { expect, test, type Page, type Route } from '@playwright/test'
import { fixture } from './fixtures/community'

async function app(page: Page) {
  const base = await fixture(page)
  base.corrections[0].status = 'SUBMITTED'
  const user = { id: 'owner', username: 'learner', onboardingCompleted: true, nativeLanguage: 'ko', uiLanguage: 'ko',
    learningLanguages: ['ja'], fluentLanguages: [], badges: [], correctorLevel: 'NATIVE', reputationScore: 0, correctionStreak: 0 }
  const state = { base, user, stall: new Set<string>(), held: [] as Route[], writes: [] as string[], reads: 0, stallReads: false }
  await page.route('**/api/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    if (!path.startsWith('/api/users/me') && !path.startsWith('/api/corrections/') && path !== '/api/correction-requests/request-1') return route.fallback()
    if (method === 'GET') state.reads++
    else state.writes.push(method + ' ' + path)
    if (state.stall.has(method + ' ' + path) || (state.stallReads && method === 'GET')) { state.held.push(route); return }
    if (path.startsWith('/api/users/me')) {
      if (method === 'PATCH') Object.assign(user, req.postDataJSON())
      return method === 'DELETE' ? route.fulfill({ status: 204 }) : route.fulfill({ json: user })
    }
    if (method === 'GET') return route.fallback()
    if (path.endsWith('/like')) return route.fulfill({ json: { liked: method === 'PUT', likeCount: method === 'PUT' ? 3 : 0 } })
    return route.fulfill({ status: 204 })
  })
  page.on('dialog', dialog => dialog.accept())
  return state
}

async function nickname(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: '닉네임 변경', exact: true }).click()
  await page.locator('#nickname-input').fill('changed_name')
}
const save = (page: Page) => page.getByRole('button', { name: '저장', exact: true })
const alert = (page: Page) => page.getByRole('main').getByRole('alert')

test('nickname timeout keeps input, blocks double saves, and allows read recovery', async ({ page }) => {
  const state = await app(page); state.stall.add('PATCH /api/users/me/username')
  await nickname(page); await page.clock.install(); await save(page).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await expect(page.locator('#nickname-input')).toBeDisabled()
  await expect(page.getByRole('button', { name: '취소', exact: true })).toBeDisabled()
  await page.clock.fastForward(30_001)
  await expect(alert(page)).toContainText('저장 완료 여부')
  await expect(page.locator('#nickname-input')).toHaveValue('changed_name'); await expect(save(page)).toBeEnabled()
  const reads = state.reads; await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect.poll(() => state.reads).toBeGreaterThan(reads)
  await expect(page.locator('#nickname-input')).toHaveValue('changed_name')
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1)
})

test('confirmed nickname is visible even while follow-up reads stall', async ({ page }) => {
  const state = await app(page); await nickname(page); state.stallReads = true
  await save(page).click(); await expect.poll(() => state.held.length).toBeGreaterThan(0)
  await expect(page.locator('#nickname-input')).toHaveCount(0)
  await expect(page.getByText('changed_name', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '닉네임 변경', exact: true }).click()
  await expect(page.locator('#nickname-input')).toHaveValue('changed_name')
})

test('language timeout retains choices through a read refresh without replay', async ({ page }) => {
  const state = await app(page); state.stall.add('PATCH /api/users/me/languages')
  await page.goto('/profile/language-edit')
  const english = page.getByRole('button', { name: /영어/ }).first()
  await english.click(); await page.clock.install()
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1); await expect(english).toBeDisabled()
  await page.clock.fastForward(30_001); await expect(alert(page)).toContainText('저장 완료 여부')
  await expect(english).toBeEnabled(); await expect(english).toHaveClass(/border-blue-500/)
  const reads = state.reads; state.user.nativeLanguage = 'ja'
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect.poll(() => state.reads).toBeGreaterThan(reads)
  await expect(english).toHaveClass(/border-blue-500/)
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1)
})

test('confirmed languages navigate without waiting for profile reads', async ({ page }) => {
  const state = await app(page); await page.goto('/profile/language-edit')
  await page.getByRole('button', { name: /영어/ }).first().click(); state.stallReads = true
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/); await expect.poll(() => state.held.length).toBeGreaterThan(0)
  await expect(page.getByText(/영어 원어민/)).toBeVisible()
})

test('late language completion does not redirect a newer screen', async ({ page }) => {
  const state = await app(page); state.stall.add('PATCH /api/users/me/languages')
  await page.goto('/profile/language-edit'); await page.getByRole('button', { name: /영어/ }).first().click()
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect.poll(() => state.held.length).toBe(1)
  await page.getByRole('link', { name: '커뮤니티', exact: true }).click(); await expect(page).toHaveURL(/community$/)
  const response = page.waitForResponse('**/api/users/me/languages')
  await state.held[0].fulfill({ json: { ...state.user, nativeLanguage: 'en' } }); await response
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.waitForURL(/\/profile$/, { timeout: 1000 })).rejects.toThrow()
})

test('UI language timeout keeps the selection without changing the active language or retrying', async ({ page }) => {
  const state = await app(page); state.stall.add('PATCH /api/users/me/languages')
  await page.goto('/profile/settings'); await expect(page.locator('#ui-language')).toBeEnabled(); await page.clock.install()
  await page.locator('#ui-language').selectOption('en'); await expect.poll(() => state.writes.length).toBe(1)
  await expect(page.locator('#ui-language')).toBeDisabled(); await page.clock.fastForward(30_001)
  await expect(alert(page)).toContainText('저장 완료 여부'); await expect(page.locator('#ui-language')).toHaveValue('en')
  await expect(page.locator('#ui-language')).toBeEnabled(); await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1)
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(page.locator('#ui-language')).toHaveValue('en')
  state.stall.clear(); await save(page).click()
  await expect.poll(() => state.writes.length).toBe(2)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('confirmed UI language updates immediately when reads stall', async ({ page }) => {
  const state = await app(page); await page.goto('/profile/settings'); await expect(page.locator('#ui-language')).toBeEnabled()
  state.stallReads = true; await page.locator('#ui-language').selectOption('en')
  await expect.poll(() => state.held.length).toBeGreaterThan(0)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en'); await expect(page.locator('#ui-language')).toBeEnabled()
})

test('account deletion timeout unlocks and never retries or logs out automatically', async ({ page }) => {
  const state = await app(page); state.stall.add('DELETE /api/users/me')
  await page.goto('/profile/settings'); await expect(page.locator('#ui-language')).toBeEnabled(); await page.clock.install()
  await page.getByRole('button', { name: /회원탈퇴/ }).click(); await expect.poll(() => state.writes.length).toBe(1)
  await page.clock.fastForward(30_001); await expect(alert(page)).toContainText('처리 완료 여부')
  await expect(page.getByRole('button', { name: /회원탈퇴/ })).toBeEnabled()
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1); await expect(page).toHaveURL(/settings$/)
})

for (const action of ['logout', 'delete']) test(`${action} clears local session immediately and a stalled cookie logout cannot block the next login forever`, async ({ page }) => {
  await app(page); let logout: Route | undefined; let logins = 0
  await page.route('**/api/auth/logout', route => { logout = route })
  await page.route('**/api/auth/login', route => { logins++; return route.fulfill({ json: { accessToken: 'new-account' } }) })
  await page.goto('/profile/settings'); await expect(page.locator('#ui-language')).toBeEnabled(); await page.clock.install()
  await page.getByRole('button', { name: action === 'delete' ? /회원탈퇴/ : /로그아웃/ }).click()
  await expect.poll(() => !!logout).toBe(true); await expect(page).toHaveURL(/login$/)
  await page.getByLabel('이메일', { exact: true }).fill('new@example.com')
  await page.getByLabel('비밀번호', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  expect(logins).toBe(0)
  await page.clock.fastForward(30_001)
  await expect.poll(() => logins).toBe(1); await expect(page).toHaveURL(/\/study$/)
  await logout!.fulfill({ status: 204 }).catch(() => {})
  await expect(page).toHaveURL(/\/study$/)
})

const actions = ['rate', 'accept', 'like', 'delete-correction', 'delete-request'] as const
const endpoint = (action: typeof actions[number]) => action === 'delete-request' ? 'DELETE /api/correction-requests/request-1'
  : action === 'delete-correction' ? 'DELETE /api/corrections/correction-1' : `${action === 'like' ? 'PUT' : 'POST'} /api/corrections/correction-1/${action}`
const actionButton = (page: Page, action: typeof actions[number]) => page.getByRole('button', {
  name: action === 'rate' ? /👍/ : action === 'accept' ? '채택하기' : action === 'like' ? /♥/ : '삭제', exact: action === 'accept' || action.startsWith('delete'),
})
async function result(page: Page, state: Awaited<ReturnType<typeof app>>, action: typeof actions[number]) {
  if (action === 'delete-correction') { state.base.viewer = 'helper'; state.user.id = 'helper' }
  await page.goto('/result/request-1'); await expect(actionButton(page, action)).toBeVisible()
}

for (const action of actions) test(`result ${action} times out visibly, releases controls and offers read-only recovery`, async ({ page }) => {
  const state = await app(page); state.stall.add(endpoint(action)); await result(page, state, action); await page.clock.install()
  await actionButton(page, action).click(); await expect.poll(() => state.writes.length).toBe(1)
  await expect(actionButton(page, action)).toBeDisabled(); await page.clock.fastForward(30_001)
  await expect(alert(page)).toContainText('처리 완료 여부'); await expect(actionButton(page, action)).toBeEnabled()
  const reads = state.reads; await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect.poll(() => state.reads).toBeGreaterThan(reads)
  await page.clock.fastForward(60_000); expect(state.writes).toHaveLength(1)
})

for (const action of actions) test(`confirmed result ${action} is reflected without waiting for stalled reads`, async ({ page }) => {
  const state = await app(page); await result(page, state, action); state.stallReads = true
  await actionButton(page, action).click(); await expect.poll(() => state.writes.length).toBe(1)
  if (action === 'delete-request') { await expect(page).toHaveURL(/community$/); return }
  await expect.poll(() => state.held.length).toBeGreaterThan(0)
  if (action === 'rate') { await expect(page.getByText('평가 완료', { exact: true })).toBeVisible(); await expect(actionButton(page, action)).toHaveCount(0) }
  if (action === 'accept') { await expect(page.getByText('✓ 채택됨', { exact: true })).toBeVisible(); await expect(actionButton(page, action)).toHaveCount(0) }
  if (action === 'like') { await expect(actionButton(page, action)).toHaveAttribute('aria-pressed', 'true'); await expect(actionButton(page, action)).toContainText('3'); await expect(actionButton(page, action)).toBeEnabled() }
  if (action === 'delete-correction') await expect(page.getByText('Corrected practice', { exact: true })).toHaveCount(0)
})

test('a timed-out rating committed on the server is recovered by reading without resubmission', async ({ page }) => {
  const state = await app(page); state.stall.add(endpoint('rate')); await result(page, state, 'rate'); await page.clock.install()
  await actionButton(page, 'rate').click(); await expect.poll(() => state.writes.length).toBe(1)
  await page.clock.fastForward(30_001); await expect(alert(page)).toContainText('처리 완료 여부')
  Object.assign(state.base.corrections[0], { ratedByMe: true })
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(page.getByText('평가 완료', { exact: true })).toBeVisible(); await expect(actionButton(page, 'rate')).toHaveCount(0)
  expect(state.writes).toHaveLength(1)
})

test('only the requester is offered rating controls', async ({ page }) => {
  const state = await app(page); await result(page, state, 'delete-correction')
  await expect(actionButton(page, 'rate')).toHaveCount(0)
})

test('late request deletion cannot navigate away from a newer screen', async ({ page }) => {
  const state = await app(page); state.stall.add(endpoint('delete-request')); await result(page, state, 'delete-request')
  await actionButton(page, 'delete-request').click(); await expect.poll(() => state.held.length).toBe(1)
  await page.getByRole('button', { name: '←', exact: true }).click(); await expect(page).toHaveURL(/community$/)
  await page.getByRole('link', { name: '프로필', exact: true }).click(); await expect(page).toHaveURL(/profile$/)
  const response = page.waitForResponse('**/api/correction-requests/request-1')
  await state.held[0].fulfill({ status: 204 }); await response
  await expect(page.waitForURL(/community$/, { timeout: 1000 })).rejects.toThrow()
})


test('the newest result action error replaces an earlier timeout', async ({ page }) => {
  const state = await app(page); state.stall.add(endpoint('rate')); await result(page, state, 'rate'); await page.clock.install()
  await actionButton(page, 'rate').click(); await expect.poll(() => state.writes.length).toBe(1)
  await page.clock.fastForward(30_001); await expect(alert(page)).toContainText('처리 완료 여부')
  await page.route('**/api/corrections/correction-1/accept', route => route.fulfill({ status: 409, json: { message: 'Current acceptance failed' } }))
  await actionButton(page, 'accept').click(); await expect(alert(page)).toContainText('Current acceptance failed')
  await expect(alert(page)).not.toContainText('처리 완료 여부')
})


test('an older UI-language response cannot overwrite a newer confirmed setting', async ({ page }) => {
  const state = await app(page); state.stall.add('PATCH /api/users/me/languages')
  await page.goto('/profile/settings'); await expect(page.locator('#ui-language')).toBeEnabled()
  await page.locator('#ui-language').selectOption('fr'); await expect.poll(() => state.held.length).toBe(1)
  await page.getByRole('button', { name: 'back', exact: true }).click()
  await page.getByRole('button', { name: '설정', exact: true }).click()
  state.stall.clear(); state.stallReads = true
  await page.locator('#ui-language').selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const heldBefore = state.held.length
  const response = page.waitForResponse('**/api/users/me/languages')
  await state.held[0].fulfill({ json: { ...state.user, uiLanguage: 'fr' } }); await response
  await expect.poll(() => state.held.length).toBeGreaterThan(heldBefore)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('#ui-language')).toHaveValue('en')
})

test('an older like response cannot overwrite a newer confirmed unlike after returning', async ({ page }) => {
  const state = await app(page); state.stall.add(endpoint('like')); await result(page, state, 'like')
  await actionButton(page, 'like').click(); await expect.poll(() => state.held.length).toBe(1)
  await page.getByRole('button', { name: '←', exact: true }).click(); await expect(page).toHaveURL(/community$/)
  await page.goBack(); await expect(page).toHaveURL(/result\/request-1$/)
  state.stall.clear(); state.stallReads = true
  await actionButton(page, 'like').click(); await expect(actionButton(page, 'like')).toHaveAttribute('aria-pressed', 'true')
  await actionButton(page, 'like').click(); await expect(actionButton(page, 'like')).toHaveAttribute('aria-pressed', 'false')
  const heldBefore = state.held.length
  const response = page.waitForResponse('**/api/corrections/correction-1/like')
  await state.held[0].fulfill({ json: { liked: true, likeCount: 1 } }); await response
  await expect.poll(() => state.held.length).toBeGreaterThan(heldBefore)
  await expect(actionButton(page, 'like')).toBeEnabled()
  await expect(actionButton(page, 'like')).toHaveAttribute('aria-pressed', 'false')
})


for (const editor of ['nickname', 'languages']) test(`review: ${editor} input stays editable when recovery reads fail`, async ({ page }) => {
  const state = await app(page)
  state.stall.add('PATCH /api/users/me/' + (editor === 'nickname' ? 'username' : 'languages'))
  if (editor === 'nickname') await nickname(page)
  else { await page.goto('/profile/language-edit'); await page.getByRole('button', { name: /영어/ }).first().click() }
  await page.clock.install()
  await page.getByRole('button', { name: editor === 'nickname' ? '저장' : '저장하기', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1); await page.clock.fastForward(30_001)
  await expect(alert(page)).toContainText('저장 완료 여부')
  await page.route('**/api/users/me{,/profile}', route => route.fulfill({ status: 503, json: {} }))
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible()
  if (editor === 'nickname') {
    await expect(page.locator('#nickname-input')).toBeVisible()
    await expect(page.locator('#nickname-input')).toHaveValue('changed_name')
    await expect(page.locator('#nickname-input')).toBeEnabled()
  } else {
    const choice = page.getByRole('button', { name: /영어/ }).first()
    await expect(choice).toBeVisible(); await expect(choice).toBeEnabled(); await expect(choice).toHaveClass(/border-blue-500/)
  }
})

test('review: saving a recovered language draft preserves the refreshed UI language', async ({ page }) => {
  const state = await app(page); state.stall.add('PATCH /api/users/me/languages')
  await page.goto('/profile/language-edit'); await page.getByRole('button', { name: /영어/ }).first().click(); await page.clock.install()
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1); await page.clock.fastForward(30_001)
  await expect(alert(page)).toContainText('저장 완료 여부')
  state.user.uiLanguage = 'en'
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  state.stall.clear()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(2)
  await expect(page).toHaveURL(/\/profile$/)
  expect(state.user.nativeLanguage).toBe('en'); expect(state.user.uiLanguage).toBe('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

for (const outcome of ['failure', 'timeout']) test(`review: ${outcome} during logout cannot restore the old account after reload`, async ({ page }) => {
  await app(page); let refreshes = 0, signedOut = false
  await page.route('**/api/auth/refresh', route => { refreshes++; return route.fulfill({ json: { accessToken: 'old-account' } }) })
  await page.route('**/api/auth/logout', route => { signedOut = true; if (outcome === 'failure') return route.fulfill({ status: 503, json: {} }) })
  await page.goto('/profile/settings'); await expect(page.locator('#ui-language')).toBeEnabled(); await page.clock.install()
  await page.getByRole('button', { name: /로그아웃/ }).click()
  await expect.poll(() => signedOut).toBe(true); await expect(page).toHaveURL(/login$/)
  await page.clock.fastForward(30_001)
  const before = refreshes
  await page.reload(); await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible()
  expect(refreshes).toBe(before)
  // Assert middleware separately: Next normalizes loopback hosts in redirects,
  // while real cookie-restoration behavior above must stay on the original origin.
  const redirect = await page.request.get('/profile', { maxRedirects: 0 })
  expect(redirect.status()).toBe(307)
  const target = new URL(redirect.headers().location, page.url())
  expect(target.pathname).toBe('/login'); expect(target.searchParams.get('redirect')).toBe('/profile')
  expect(refreshes).toBe(before)
})

test('review: confirmed result deletion removes cached community requests while reads stall', async ({ page }) => {
  const state = await app(page); let hold = false, held = 0
  await page.route('**/api/correction-requests/{mine,feed/page}*', route => { if (hold) { held++; return }; return route.fallback() })
  await page.goto('/community'); await page.getByRole('button', { name: '내 요청', exact: true }).click()
  await page.getByText('Original practice', { exact: true }).click(); await expect(page).toHaveURL(/result\/request-1$/)
  hold = true; await actionButton(page, 'delete-request').click(); await expect(page).toHaveURL(/community$/)
  await expect.poll(() => held).toBeGreaterThan(0)
  await expect(page.getByText('Original practice', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '내 요청', exact: true }).click()
  await expect(page.getByText('Original practice', { exact: true })).toHaveCount(0)
  expect(state.writes).toHaveLength(1)
})


test('review: only a successful explicit password login re-enables restoration', async ({ page, context }) => {
  await app(page); let loginWorks = false, refreshes = 0
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 503, json: {} }))
  await page.route('**/api/auth/login', route => route.fulfill(loginWorks
    ? { json: { accessToken: 'new-account' } } : { status: 401, json: {} }))
  await page.route('**/api/auth/refresh', route => { refreshes++; return route.fulfill({ json: { accessToken: 'restored-new' } }) })
  await page.goto('/profile/settings'); await expect(page.locator('#ui-language')).toBeEnabled()
  await page.getByRole('button', { name: /로그아웃/ }).click(); await expect(page).toHaveURL(/login$/)
  await page.getByLabel('이메일', { exact: true }).fill('new@example.com'); await page.getByLabel('비밀번호', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeEnabled()
  expect((await context.cookies()).some(cookie => cookie.name === 'tonebridge_signed_out' && cookie.value === '1')).toBe(true)
  loginWorks = true; await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page).toHaveURL(/study$/)
  expect((await context.cookies()).some(cookie => cookie.name === 'tonebridge_signed_out')).toBe(false)
  const before = refreshes; await page.reload(); await expect(page.getByRole('heading', { name: '친구와 연습', exact: true })).toBeVisible()
  expect(refreshes).toBe(before + 1)
})

test('review: successful OAuth clears local signout and survives reload', async ({ page, context }) => {
  await app(page)
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 503, json: {} }))
  await page.goto('/profile/settings'); await expect(page.locator('#ui-language')).toBeEnabled()
  await page.getByRole('button', { name: /로그아웃/ }).click(); await expect(page).toHaveURL(/login$/)
  await page.route('**/api/auth/google/callback*', route => route.fulfill({ status: 302,
    headers: { Location: '/auth/callback#token=fixture.oauth.signature', 'Set-Cookie': 'tonebridge_signed_out=; Max-Age=0; Path=/; SameSite=Lax' } }))
  await page.goto('/api/auth/google/callback?code=fixture&state=fixture'); await expect(page).toHaveURL(/study$/)
  expect((await context.cookies()).some(cookie => cookie.name === 'tonebridge_signed_out')).toBe(false)
  await page.reload(); await expect(page.getByRole('heading', { name: '친구와 연습', exact: true })).toBeVisible()
})

test('review: another tab cannot restore from a refresh response started before logout', async ({ page, context }) => {
  await app(page); await page.route('**/api/auth/logout', route => route.fulfill({ status: 503, json: {} }))
  await page.goto('/profile/settings'); await expect(page.locator('#ui-language')).toBeEnabled()
  const other = await context.newPage(); await fixture(other); let held: Route | undefined
  await other.route('**/api/auth/refresh', route => { held = route })
  await other.goto('/profile'); await expect.poll(() => !!held).toBe(true)
  await page.getByRole('button', { name: /로그아웃/ }).click(); await expect(page).toHaveURL(/login$/)
  await held!.fulfill({ json: { accessToken: 'obsolete-restored' }, headers: { 'Set-Cookie': 'session=1; Path=/; SameSite=Lax' } })
  await expect(other).toHaveURL(/login/)
  await expect(other.getByRole('link', { name: '프로필', exact: true })).toHaveCount(0)
  expect((await context.cookies()).some(cookie => cookie.name === 'tonebridge_signed_out' && cookie.value === '1')).toBe(true)
  await other.close()
})
