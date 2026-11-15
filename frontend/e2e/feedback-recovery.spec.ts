import { expect, test, type Page } from '@playwright/test'
import { fixture } from './fixtures/community'

async function saved(page: Page, text: string) {
  await expect.poll(() => page.evaluate(text => Object.keys(localStorage).some(key => key.startsWith('tonebridge-recovery:') && localStorage.getItem(key)?.includes(text)), text)).toBe(true)
}

test('feedback text and tags restore after reload and remain scoped to their request', async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'
  await page.goto('/correct/request-1')
  await page.getByRole('textbox').first().fill('Recovered corrected sentence')
  await page.getByRole('textbox').last().fill('Recovered explanation with enough detail for submission.')
  await page.getByRole('button', { name: '문법', exact: true }).click()
  // The preceding text edit may already be durable while the tag write still holds a Web Lock.
  // Wait for the last edit, not an older snapshot, before simulating a reload.
  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('tonebridge-recovery:helper:feedback:request-1'))
    return key ? JSON.parse(localStorage.getItem(key)!).value?.selectedTags : null
  })).toEqual(['문법'])
  await page.reload()
  await expect(page.getByRole('textbox').first()).toHaveValue('Recovered corrected sentence')
  await expect(page.getByRole('textbox').last()).toHaveValue('Recovered explanation with enough detail for submission.')
  await page.goto('/correct/request-2')
  await expect(page.getByRole('textbox').last()).toHaveValue('')
  await page.goto('/drafts')
  await expect(page.getByTestId('managed-feedback')).toHaveCount(1)
  await page.getByTestId('managed-feedback').getByRole('link').click()
  await expect(page).toHaveURL(/correct\/request-1$/)
  await expect(page.getByRole('textbox').last()).toHaveValue('Recovered explanation with enough detail for submission.')
  await page.getByRole('button', { name: '첨삭 제출하기', exact: true }).click()
  await expect(page).toHaveURL(/community$/)
  const posted = state.writes.find(write => write.path === '/api/corrections')!
  expect(posted.body.tags).toEqual(['문법'])
  await page.goto('/correct/request-1')
  await expect(page.getByRole('textbox').last()).toHaveValue('')
})

test('audio feedback restores scores, timestamp comments, unfinished comment and reference recording', async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'; state.request.type = 'AUDIO'
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/correct/request-1')
  await expect(page.getByRole('button', { name: /▶.*재생/ })).toBeEnabled()
  const comment = page.getByRole('textbox').first()
  await comment.fill('Saved timestamp comment'); await comment.press('Enter')
  await comment.fill('Unfinished comment')
  await page.getByRole('slider').first().press('End')
  await page.getByRole('textbox').last().fill('Audio feedback that should survive a reload.')
  await page.getByRole('button', { name: /녹음 시작/ }).click()
  await expect(page.getByRole('button', { name: /중지/ })).toBeVisible()
  await page.waitForTimeout(500); await page.getByRole('button', { name: /중지/ }).click()
  await expect(page.locator('audio[controls]')).toBeVisible()
  await saved(page, 'Unfinished comment')
  await page.reload()
  await expect(page.getByRole('textbox').first()).toHaveValue('Unfinished comment')
  await expect(page.getByText('Saved timestamp comment', { exact: true })).toBeVisible()
  await expect(page.getByRole('slider').first()).toHaveValue('10')
  await expect(page.locator('audio[controls]')).toBeVisible()
  await page.goto('/drafts')
  await expect(page.getByTestId('managed-recording').getByRole('heading')).toContainText('피드백 참고 녹음')
  await page.getByTestId('managed-recording').getByRole('button', { name: /계속|이어서/ }).click()
  await expect(page).toHaveURL(/correct\/request-1$/)
})

for (const audio of [false, true]) test(`a lost ${audio ? 'audio' : 'text'} feedback response resumes the same submission after reload`, async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'; if (audio) state.request.type = 'AUDIO'
  const posts: { key: string; body: unknown }[] = []
  await page.route('**/api/corrections', route => {
    posts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
    return posts.length === 1 ? route.abort('failed') : route.fulfill({ status: 201, json: { id: 'same-correction' } })
  })
  await page.goto('/correct/request-1')
  await page.getByRole('textbox').last().fill('Stable feedback content after an uncertain response.')
  if (audio) {
    await page.getByRole('button', { name: /녹음 시작/ }).click()
    await expect(page.getByRole('button', { name: /중지/ })).toBeVisible()
    await page.waitForTimeout(500); await page.getByRole('button', { name: /중지/ }).click()
    await expect(page.locator('audio[controls]')).toBeVisible()
  }
  await page.getByRole('button', { name: '첨삭 제출하기', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('저장 완료 여부')
  await page.reload()
  await expect(page.getByRole('textbox').last()).toHaveValue('Stable feedback content after an uncertain response.')
  await expect(page.getByRole('textbox').last()).toBeDisabled()
  await page.getByRole('button', { name: '첨삭 제출하기', exact: true }).click()
  await expect(page).toHaveURL(/community$/)
  expect(posts).toHaveLength(2)
  expect(posts[0].key).toMatch(/^[0-9a-f-]{36}$/)
  expect(posts[1]).toEqual(posts[0])
  expect(state.uploads).toBe(audio ? 1 : 0)
})

test('a lost card save resumes through draft management with its original identity and input', async ({ page }) => {
  await fixture(page)
  const posts: { key: string; body: unknown }[] = []
  await page.route('**/api/sessions/session-1/cards', route => {
    posts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
    return posts.length === 1 ? route.abort('failed') : route.fulfill({ status: 201, json: { id: 'saved-once' } })
  })
  await page.goto('/result/request-1')
  await page.getByRole('button', { name: '스터디 카드로 저장', exact: true }).click()
  await page.getByRole('dialog').getByLabel('표현', { exact: true }).fill('One durable card')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('저장 완료 여부')
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  await page.goto('/drafts')
  await page.getByTestId('managed-feedback').getByRole('link').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByLabel('표현', { exact: true })).toHaveValue('One durable card')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('link', { name: /카드 열기/ })).toHaveAttribute('href', '/study/session-1/cards/saved-once')
  expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0])
  expect(posts[0].key).toMatch(/^[0-9a-f-]{36}$/)
})

for (const committed of [false, true]) test(`editing an uncertain submission first resolves the ${committed ? 'committed' : 'uncommitted'} operation`, async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'
  const keys: string[] = []; let cancelledKey = ''
  await page.route('**/api/corrections', route => {
    keys.push(route.request().headers()['idempotency-key'])
    return keys.length === 1 ? route.abort('failed') : route.fulfill({ status: 201, json: { id: 'new-correction' } })
  })
  await page.route('**/api/submissions/*/cancel', route => {
    cancelledKey = new URL(route.request().url()).pathname.split('/')[3]
    return route.fulfill({ json: committed ? { type: 'correction', resourceId: 'already-saved', parentId: 'request-1' } : { type: 'cancelled' } })
  })
  await page.goto('/correct/request-1')
  await page.getByRole('textbox').last().fill('Original immutable submission text.')
  await page.getByRole('button', { name: '첨삭 제출하기', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: '저장 결과 확인 후 수정', exact: true }).click()
  await expect.poll(() => cancelledKey).toBe(keys[0])
  if (committed) { await expect(page).toHaveURL(/community$/); expect(keys).toHaveLength(1) }
  else {
    await expect(page.getByRole('textbox').last()).toBeEnabled()
    await page.getByRole('textbox').last().fill('Revised submission after cancellation.')
    await page.getByRole('button', { name: '첨삭 제출하기', exact: true }).click()
    await expect(page).toHaveURL(/community$/)
    expect(keys).toHaveLength(2); expect(keys[1]).not.toBe(keys[0])
  }
})

test('storage failure preserves input and prevents a write without a durable identity', async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem
    Object.assign(window, { failRecoveryStorage: true })
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('tonebridge-recovery:') && (window as unknown as { failRecoveryStorage: boolean }).failRecoveryStorage) throw new DOMException('full', 'QuotaExceededError')
      return set.call(this, key, value)
    }
  })
  await page.goto('/correct/request-1')
  await page.getByRole('textbox').last().fill('Keep this feedback when browser storage is full.')
  await expect(page.getByTestId('recovery-draft').getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: '첨삭 제출하기', exact: true })).toBeDisabled()
  expect(state.writes.filter(write => write.path === '/api/corrections')).toHaveLength(0)
  await page.evaluate(() => Object.assign(window, { failRecoveryStorage: false }))
  await page.getByTestId('recovery-draft').getByRole('button', { name: /재시도/ }).click()
  await expect(page.getByRole('button', { name: '첨삭 제출하기', exact: true })).toBeEnabled()
  await expect(page.getByRole('textbox').last()).toHaveValue('Keep this feedback when browser storage is full.')
})

test('a stale second tab cannot overwrite the newer feedback draft', async ({ page, context }) => {
  const state = await fixture(page); state.viewer = 'helper'
  await page.goto('/correct/request-1')
  await expect(page.getByRole('textbox').last()).toBeEnabled()
  const other = await context.newPage(); const otherState = await fixture(other); otherState.viewer = 'helper'
  await other.goto('/correct/request-1'); await expect(other.getByRole('textbox').last()).toBeEnabled()
  await page.getByRole('textbox').last().fill('Newer feedback draft from the first tab.')
  await saved(page, 'Newer feedback draft')
  await other.getByRole('textbox').last().fill('Stale tab must not replace the newer text.')
  await expect(other.getByTestId('recovery-draft').getByRole('alert')).toBeVisible()
  await expect(other.getByRole('button', { name: '첨삭 제출하기', exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('textbox').last()).toHaveValue('Newer feedback draft from the first tab.')
  await other.close()
})


test('logout removes feedback recovery data and the next account starts with an empty editor', async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'
  await page.goto('/correct/request-1')
  await page.getByRole('textbox').last().fill('Private draft belonging only to the first account.')
  await saved(page, 'Private draft belonging')
  await page.goto('/profile/settings')
  await page.getByRole('button', { name: /^로그아웃/ }).click()
  await expect(page).toHaveURL(/login$/)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('tonebridge-recovery:helper:')))).toEqual([])
  state.viewer = 'another-user'
  await page.getByLabel('이메일', { exact: true }).fill('other@example.test')
  await page.getByLabel('비밀번호', { exact: true }).fill('Fixture1!')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/study$/)
  await page.goto('/correct/request-1')
  await expect(page.getByRole('textbox').last()).toHaveValue('')
})

for (const committed of [false, true]) test(`card edits resolve an uncertain ${committed ? 'completed' : 'cancelled'} save before changing identity`, async ({ page }) => {
  await fixture(page)
  const keys: string[] = []; let cancelledKey = ''
  await page.route('**/api/sessions/session-1/cards', route => {
    keys.push(route.request().headers()['idempotency-key'])
    return keys.length === 1 ? route.abort('failed') : route.fulfill({ status: 201, json: { id: 'revised-card' } })
  })
  await page.route('**/api/submissions/*/cancel', route => {
    cancelledKey = new URL(route.request().url()).pathname.split('/')[3]
    return route.fulfill({ json: committed ? { type: 'card', resourceId: 'existing-card', parentId: 'session-1' } : { type: 'cancelled' } })
  })
  await page.goto('/result/request-1')
  await page.getByRole('button', { name: '스터디 카드로 저장', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('표현', { exact: true }).fill('Immutable card content')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('button', { name: '저장 결과 확인 후 수정', exact: true }).click()
  await expect.poll(() => cancelledKey).toBe(keys[0])
  if (committed) {
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('link', { name: /카드 열기/ })).toHaveAttribute('href', '/study/session-1/cards/existing-card')
    expect(keys).toHaveLength(1)
  } else {
    await expect(dialog.getByLabel('표현', { exact: true })).toBeEnabled()
    await dialog.getByLabel('표현', { exact: true }).fill('Revised card content')
    await dialog.getByRole('button', { name: '저장', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(keys).toHaveLength(2); expect(keys[1]).not.toBe(keys[0])
  }
})


test('expired drafts are removed and malformed feedback is reported without enabling submission', async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'
  await page.goto('/correct/request-1')
  await page.getByRole('textbox').last().fill('A draft that will expire after seven days.')
  await saved(page, 'A draft that will expire')
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('tonebridge-recovery:helper:'))!
    const row = JSON.parse(localStorage.getItem(key)!); row.updatedAt = Date.now() - 8 * 86400000
    localStorage.setItem(key, JSON.stringify(row))
  })
  await page.reload()
  await expect(page.getByRole('textbox').last()).toHaveValue('')
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('tonebridge-recovery:helper:')))).toEqual([])
  await page.getByRole('textbox').last().fill('Fresh draft before storage corruption.')
  await saved(page, 'Fresh draft before storage')
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('tonebridge-recovery:helper:'))!
    const row = JSON.parse(localStorage.getItem(key)!); row.value.timestampComments = 'invalid'
    localStorage.setItem(key, JSON.stringify(row))
  })
  await page.reload()
  await expect(page.getByTestId('recovery-draft').getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: '첨삭 제출하기', exact: true })).toBeDisabled()
  expect(state.writes.filter(write => write.path === '/api/corrections')).toHaveLength(0)
})


test('rapid repeated feedback submission keeps a single durable identity', async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'
  const keys: string[] = []
  await page.route('**/api/corrections', async route => {
    keys.push(route.request().headers()['idempotency-key'])
    await new Promise(resolve => setTimeout(resolve, 250))
    await route.abort('failed')
  })
  await page.goto('/correct/request-1')
  await page.getByRole('textbox').last().fill('One submission despite rapid repeated clicks.')
  const submit = page.getByRole('button', { name: '첨삭 제출하기', exact: true })
  await expect(submit).toBeEnabled()
  await submit.evaluate(button => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await expect(page.getByRole('main').getByRole('alert')).toContainText('저장 완료 여부')
  await submit.click()
  await expect.poll(() => keys.length).toBeGreaterThanOrEqual(2)
  expect(new Set(keys).size).toBe(1)
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
})


async function holdDraftLock(page: Page) {
  await page.evaluate(async () => {
    const key = Object.keys(localStorage).find(key => key.startsWith('tonebridge-recovery:'))!
    await new Promise<void>(resolve => {
      void navigator.locks.request(key, () => new Promise<void>(release => {
        Object.assign(window, { releaseRecoveryLock: release }); resolve()
      }))
    })
  })
}
async function releaseDraftLock(page: Page) {
  await page.evaluate(() => (window as unknown as { releaseRecoveryLock: () => void }).releaseRecoveryLock())
}

test('a blocked local submission times out without later freezing or sending old input', async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'
  await page.clock.install()
  await page.goto('/correct/request-1')
  await page.getByRole('textbox').last().fill('Original feedback before the blocked save.')
  await saved(page, 'Original feedback before')
  await holdDraftLock(page)
  await page.getByRole('button', { name: '첨삭 제출하기', exact: true }).click()
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('textbox').last()).toBeEnabled()
  await page.getByRole('textbox').last().fill('New feedback after the local save timed out.')
  await releaseDraftLock(page)
  await saved(page, 'New feedback after')
  await expect(page.getByRole('textbox').last()).toBeEnabled()
  expect(state.writes.filter(write => write.path === '/api/corrections')).toHaveLength(0)
  await page.getByRole('button', { name: '첨삭 제출하기', exact: true }).click()
  await expect(page).toHaveURL(/community$/)
  expect(state.writes.find(write => write.path === '/api/corrections')?.body.explanation).toBe('New feedback after the local save timed out.')
})

test('a successful card save finishes even when local receipt cleanup is blocked', async ({ page }) => {
  await fixture(page)
  await page.clock.install()
  await page.route('**/api/sessions/session-1/cards', async route => {
    await holdDraftLock(page)
    await route.fulfill({ status: 201, json: { id: 'saved-card', sessionId: 'session-1' } })
  })
  await page.goto('/result/request-1')
  await page.getByRole('button', { name: '스터디 카드로 저장', exact: true }).click()
  await page.getByRole('dialog').getByLabel('표현', { exact: true }).fill('Card with delayed local cleanup')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseRecoveryLock?: unknown }).releaseRecoveryLock)).toBe('function')
  // Allow the response handler to reach local cleanup before advancing its deadline.
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).pending?.length ?? 0)).toBeGreaterThan(0)
  await page.clock.fastForward(30_001)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /카드 열기/ })).toHaveAttribute('href', '/study/session-1/cards/saved-card')
  await releaseDraftLock(page)
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('tonebridge-recovery:') && !!JSON.parse(localStorage.getItem(key)!).pending))).toBe(true)
})

for (const corrupt of ['json', 'date']) test(`a damaged ${corrupt} draft does not hide healthy feedback drafts`, async ({ page }) => {
  const state = await fixture(page); state.viewer = 'helper'
  await page.goto('/correct/request-1')
  await page.getByRole('textbox').last().fill('Healthy feedback remains recoverable.')
  await saved(page, 'Healthy feedback remains')
  await page.evaluate(corrupt => {
    const key = Object.keys(localStorage).find(key => key.startsWith('tonebridge-recovery:'))!
    const row = JSON.parse(localStorage.getItem(key)!)
    row.scope = 'feedback:broken-request'; row.updatedAt = 1e100
    localStorage.setItem('tonebridge-recovery:helper:feedback:broken-request', corrupt === 'json' ? '{broken' : JSON.stringify(row))
  }, corrupt)
  await page.goto('/drafts')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('managed-feedback')).toHaveCount(1)
  await expect(page.getByTestId('managed-feedback')).toContainText('Healthy feedback remains recoverable.')
  await page.getByTestId('managed-feedback').getByRole('link').click()
  await expect(page.getByRole('textbox').last()).toHaveValue('Healthy feedback remains recoverable.')
  expect(state.errors).toEqual([])
})
