import { expect, test, type Page } from '@playwright/test'

const token = 'A'.repeat(43)
async function mockReset(page: Page, options: { enabled?: boolean; failOnce?: boolean; invalid?: boolean } = {}) {
  const calls: { path: string; body: Record<string,string>; authorization?: string }[] = []
  let fail = options.failOnce
  await page.context().addCookies([{name:'tonebridge_ui_language',value:'ko',domain:'127.0.0.1',path:'/'}])
  await page.route('**/api/**', async route => {
    const request=route.request(), path=new URL(request.url()).pathname
    if(path === '/api/auth/refresh') return route.fulfill({status:401,json:{}})
    if(path === '/api/auth/password-reset/status') return route.fulfill({json:{enabled:options.enabled ?? true}})
    if(path === '/api/auth/logout') return route.fulfill({status:204})
    if(request.method()==='POST') {
      calls.push({path,body:request.postDataJSON(),authorization:request.headers()['authorization']})
      if(fail) {fail=false;return route.fulfill({status:503,json:{code:'AUTH_008'}})}
      if(options.invalid) return route.fulfill({status:400,json:{code:'AUTH_007'}})
      return route.fulfill({status:path.endsWith('/confirm')?204:202})
    }
    return route.fulfill({json:[]})
  })
  return calls
}

test('login exposes reset; requests validate and give a generic inbox message', async ({page}) => {
  const calls=await mockReset(page)
  await page.goto('/login')
  await page.getByRole('link',{name:'비밀번호를 잊으셨나요?'}).click()
  await expect(page).toHaveURL(/forgot-password$/)
  await page.getByRole('button',{name:'재설정 메일 요청',exact:true}).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('이메일')
  await expect(page.getByLabel('이메일',{exact:true})).toBeFocused()
  expect(calls).toHaveLength(0)
  await page.getByLabel('이메일',{exact:true}).fill('learner@example.test')
  await page.getByRole('button',{name:'재설정 메일 요청',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('계정이 있다면')
  expect(calls).toEqual([{path:'/api/auth/password-reset',body:{email:'learner@example.test'},authorization:undefined}])
  await page.getByRole('button',{name:'새 재설정 메일 요청',exact:true}).click()
  await expect(page.getByLabel('이메일',{exact:true})).toHaveValue('learner@example.test')
})

test('mail unavailable is honest and prevents submitting', async ({page}) => {
  const calls=await mockReset(page,{enabled:false})
  await page.goto('/forgot-password')
  await expect(page.getByRole('main').getByRole('alert')).toContainText('사용할 수 없습니다')
  await expect(page.getByRole('button',{name:'재설정 메일 요청',exact:true})).toHaveCount(0)
  expect(calls).toHaveLength(0)
})

test('reset token leaves URL, mismatch sends nothing, transient failure preserves input for retry', async ({page}) => {
  const calls=await mockReset(page,{failOnce:true})
  const documents: string[]=[]
  page.on('request',r=>{if(r.isNavigationRequest()) documents.push(r.url())})
  const response=await page.goto('/reset-password#token='+token)
  expect(response?.headers()['referrer-policy']).toBe('no-referrer')
  await expect(page).toHaveURL(/reset-password$/)
  await page.getByLabel('비밀번호',{exact:true}).fill('NewPass2!')
  await page.getByLabel('새 비밀번호 확인',{exact:true}).fill('WrongPass3!')
  await page.getByRole('button',{name:'새 비밀번호 저장',exact:true}).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('서로 다릅니다')
  expect(calls).toHaveLength(0)
  await page.getByLabel('새 비밀번호 확인',{exact:true}).fill('NewPass2!')
  await page.getByRole('button',{name:'새 비밀번호 저장',exact:true}).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('사용할 수 없습니다')
  await expect(page.getByLabel('비밀번호',{exact:true})).toHaveValue('NewPass2!')
  await page.getByRole('button',{name:'새 비밀번호 저장',exact:true}).click()
  await expect(page.getByRole('heading',{name:'비밀번호가 변경되었습니다'})).toBeVisible()
  await expect(page.getByRole('status')).toContainText('모든 기기')
  expect(calls).toHaveLength(2)
  expect(calls[0].body).toEqual({token,password:'NewPass2!'})
  expect(calls[1].body).toEqual(calls[0].body)
  expect(calls.every(c=>!c.authorization)).toBe(true)
  expect(documents.every(url=>!url.includes(token))).toBe(true)
  await expect(page.getByRole('link',{name:'로그인',exact:true})).toBeVisible()
})

test('missing and rejected links provide a new request path without auto-submission', async ({page}) => {
  const calls=await mockReset(page,{invalid:true})
  await page.goto('/reset-password')
  await expect(page.getByRole('main').getByRole('alert')).toContainText('새 메일')
  expect(calls).toHaveLength(0)
  await page.goto('/reset-password#token='+token)
  await page.getByLabel('비밀번호',{exact:true}).fill('NewPass2!')
  await page.getByLabel('새 비밀번호 확인',{exact:true}).fill('NewPass2!')
  await page.getByRole('button',{name:'새 비밀번호 저장',exact:true}).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('만료')
  await page.getByRole('link',{name:'새 재설정 메일 요청',exact:true}).click()
  await expect(page).toHaveURL(/forgot-password$/)
})


test('status timeout retries in place without losing the reset token', async ({ page }) => {
  const calls = await mockReset(page)
  await page.clock.install()
  let lookups = 0
  await page.route('**/api/auth/password-reset/status', async route => {
    lookups++
    if (lookups === 1) return // Keep the first network request pending until the client aborts it.
    await route.fulfill({ json: { enabled: true } })
  })
  await page.goto('/reset-password#token=' + token)
  await expect.poll(() => lookups).toBe(1)
  await expect(page).toHaveURL(/reset-password$/)
  await page.clock.fastForward(15_001)
  await expect(page.getByRole('main').getByRole('alert')).toContainText('사용할 수 없습니다')
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await page.getByLabel('비밀번호', { exact: true }).fill('NewPass2!')
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill('NewPass2!')
  await page.getByRole('button', { name: '새 비밀번호 저장', exact: true }).click()
  await expect(page.getByRole('heading', { name: '비밀번호가 변경되었습니다' })).toBeVisible()
  expect(calls[0].body).toEqual({ token, password: 'NewPass2!' })
  expect(lookups).toBe(2)
})

test('submit timeout unlocks the form and preserves input without automatically resending', async ({ page }) => {
  await mockReset(page)
  await page.clock.install()
  let posts = 0
  await page.route('**/api/auth/password-reset', route => {
    posts++
    if (posts === 1) return
    return route.fulfill({ status: 202 })
  })
  await page.goto('/forgot-password')
  await page.getByLabel('이메일', { exact: true }).fill('learner@example.test')
  const submit = page.getByRole('button', { name: '재설정 메일 요청', exact: true })
  await submit.click(); await expect.poll(() => posts).toBe(1)
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert')).toContainText('입력은 유지')
  await expect(page.getByLabel('이메일', { exact: true })).toHaveValue('learner@example.test')
  expect(posts).toBe(1)
  await submit.click()
  await expect(page.getByRole('status')).toContainText('계정이 있다면')
  expect(posts).toBe(2)
})


test('lost password confirmation explains uncertainty and never automatically repeats the write', async ({ page }) => {
  await mockReset(page); await page.clock.install()
  let posts = 0
  await page.route('**/api/auth/password-reset/confirm', () => { posts++ })
  await page.goto('/reset-password#token=' + token)
  await page.getByLabel('비밀번호', { exact: true }).fill('NewPass2!')
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill('NewPass2!')
  await page.getByRole('button', { name: '새 비밀번호 저장', exact: true }).click()
  await expect.poll(() => posts).toBe(1)
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('main').getByRole('alert')).toContainText('변경 완료 여부를 확인하지 못했습니다')
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('NewPass2!')
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '새 재설정 메일 요청', exact: true })).toBeVisible()
  expect(posts).toBe(1)
})
