import { expect, test, type Page } from '@playwright/test'

const card = {
  id: 'card-1', sessionId: 'session-1', createdByUserId: 'friend', phrase: 'I think so.', context: null,
  explanation: null, tags: [], note: null, position: 0, createdAt: '2026-11-01T00:00:00Z', nativeAudioUrl: null,
}
const session = { id: 'session-1', title: '언어 교환', memberIds: ['owner', 'friend'], createdBy: 'friend', status: 'ACTIVE', createdAt: card.createdAt }

async function mockApi(page: Page, soundTargets: { guideId: string }[]) {
  const state = {
    errors: [] as string[],
    patches: [] as Record<string, unknown>[],
    attempt: {
      id: 'attempt-1', cardId: 'card-1', learnerId: 'friend', audioUrl: null, score: 3,
      correctionNote: 'th 가 s 처럼 들려요.', correctionAuthorId: 'owner',
      correctionUpdatedAt: '2026-11-02T00:00:00Z', attemptedAt: '2026-11-01T01:00:00Z', soundTargets,
    } as Record<string, unknown>,
  }
  page.on('pageerror', (error) => state.errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) state.errors.push(message.text()) })
  await page.context().addCookies([{ name: 'session', value: 'test-only', domain: '127.0.0.1', path: '/' }])
  await page.route('**/api/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'PATCH' && path === '/api/attempts/attempt-1/correction') {
      const body = request.postDataJSON() as Record<string, unknown>
      state.patches.push(body)
      state.attempt = { ...state.attempt, ...body }
      return route.fulfill({ json: state.attempt })
    }
    if (request.method() !== 'GET') return route.fulfill({ json: { accessToken: 'test-only' } })
    if (path === '/api/users/me') {
      // The reviewer speaks Korean natively and English fluently, so Korean sounds are listed first.
      return route.fulfill({ json: { id: 'owner', username: 'owner', onboardingCompleted: true, uiLanguage: 'ko', credits: 0, nativeLanguage: 'ko', fluentLanguages: ['en'], learningLanguages: ['ja'] } })
    }
    if (path === '/api/cards/card-1') return route.fulfill({ json: card })
    if (path === '/api/cards/card-1/attempts') return route.fulfill({ json: [state.attempt] })
    if (path === '/api/sessions/session-1') return route.fulfill({ json: session })
    return route.fulfill({ json: [] })
  })
  return state
}

test('sounds pointed out in feedback show their guide next to the note, and unknown ids are skipped', async ({ page }) => {
  const state = await mockApi(page, [{ guideId: 'en-th' }, { guideId: 'retired-guide' }])
  await page.goto('/study/session-1/cards/card-1')

  const attempt = page.locator('#attempt-attempt-1')
  await expect(attempt.getByText('th 가 s 처럼 들려요.')).toBeVisible()
  const pointed = attempt.locator('[data-feedback-sounds]')
  await expect(pointed.getByText('피드백에서 짚은 소리')).toBeVisible()
  await expect(pointed.getByText('베타', { exact: true })).toBeVisible()
  await expect(pointed.locator('[data-sound-guide]')).toHaveCount(1)
  await expect(pointed.getByText('retired-guide')).toHaveCount(0)

  await expect(pointed.getByRole('img', { name: '영어 th — 입 안 옆모습' })).toBeHidden()
  await pointed.getByText('영어 th', { exact: true }).click()
  await expect(pointed.getByRole('img', { name: '영어 th — 입 안 옆모습' })).toBeVisible()
  expect(state.errors).toEqual([])
})

test('the feedback editor saves the chosen sounds, stops at three, and an empty choice clears them', async ({ page }) => {
  const state = await mockApi(page, [{ guideId: 'en-th' }])
  await page.goto('/study/session-1/cards/card-1')
  const attempt = page.locator('#attempt-attempt-1')

  await attempt.getByRole('button', { name: '피드백 수정', exact: true }).click()
  const picker = attempt.getByRole('group', { name: '짚을 소리 (선택)' })
  const sound = (name: string) => picker.getByRole('button', { name, exact: true })
  await expect(sound('영어 th')).toHaveAttribute('aria-pressed', 'true')

  // Korean (the reviewer's native language) is listed before English.
  const groups = picker.getByRole('group')
  await expect(groups.nth(0)).toHaveAccessibleName('한국어')
  await expect(groups.nth(1)).toHaveAccessibleName('영어')

  await sound('한국어 ㄹ').click()
  await sound('영어 r').click()
  await expect(sound('영어 l')).toBeDisabled()
  await expect(picker.getByText('소리는 3개까지 고를 수 있어요.')).toBeVisible()
  if (process.env.SOUND_GUIDE_SHOT_DIR) await attempt.screenshot({ path: `${process.env.SOUND_GUIDE_SHOT_DIR}/feedback-editor-${test.info().project.name}.png` })
  await attempt.getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.patches.at(-1)?.soundTargets).toEqual([{ guideId: 'en-th' }, { guideId: 'ko-rieul' }, { guideId: 'en-r' }])
  await expect(attempt.locator('[data-feedback-sounds] [data-sound-guide]')).toHaveCount(3)

  await attempt.getByRole('button', { name: '피드백 수정', exact: true }).click()
  for (const name of ['영어 th', '한국어 ㄹ', '영어 r']) await sound(name).click()
  await attempt.getByRole('button', { name: '저장', exact: true }).click()
  await expect.poll(() => state.patches.at(-1)?.soundTargets).toEqual([])
  await expect(attempt.locator('[data-feedback-sounds]')).toHaveCount(0)
  expect(state.errors).toEqual([])
})
