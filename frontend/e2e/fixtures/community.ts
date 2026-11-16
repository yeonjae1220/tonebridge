import type { Page } from '@playwright/test'

function wav() {
  const bytes = Buffer.alloc(44 + 16000)
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(16000, 40)
  return bytes
}
export async function fixture(page: Page) {
  const state = {
    viewer: 'owner', fail: new Set<string>(), errors: [] as string[], uploads: 0,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    request: { id: 'request-1', requesterId: 'owner', type: 'TEXT', contentText: 'Original practice', audioUrl: 'audio/fixture.wav',
      targetLanguage: 'ko', feedbackGoals: [], context: '', status: 'PENDING', createdAt: new Date().toISOString() },
    corrections: [{ id: 'correction-1', requestId: 'request-1', correctorId: 'helper', correctedText: 'Corrected practice',
      explanation: 'A sufficiently detailed explanation for practice.', tags: [], status: 'APPROVED', isAi: false,
      likeCount: 0, likedByMe: false, isAccepted: false, createdAt: new Date().toISOString() }],
  }
  const userUpdates: Record<string, unknown> = {}
  page.on('pageerror', e => state.errors.push(e.message))
  await page.context().addCookies([{ name: 'session', value: 'fixture', domain: '127.0.0.1', path: '/' }])
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
    const ok = (json: unknown) => route.fulfill({ json })
    if (method !== 'GET') state.writes.push({ path, body: req.postData() ? req.postDataJSON() : {} })
    if (state.fail.has(`${method} ${path}`)) return route.fulfill({ status: 503, json: { message: '잠시 후 다시 시도해 주세요.' } })
    if (path.startsWith('/api/auth/')) return ok({ accessToken: 'fixture' })
    if (path.startsWith('/api/sse/')) return route.fulfill({ contentType: 'text/event-stream', body: ': connected\n\n' })
    if (path === '/api/users/me/username' || path === '/api/users/me/languages') Object.assign(userUpdates, req.postDataJSON())
    if (['/api/users/me', '/api/users/me/profile', '/api/users/me/username', '/api/users/me/languages'].includes(path)) return ok({ id: state.viewer, username: 'learner', onboardingCompleted: true,
      nativeLanguage: 'ko', uiLanguage: 'ko', learningLanguages: ['ja'], fluentLanguages: [], badges: [], correctorLevel: 'NATIVE', reputationScore: 0, correctionStreak: 0, ...userUpdates })
    if (path === '/api/languages/variants') return ok({})
    if (path === '/api/correction-requests/feed/page') return ok({ items: [state.request], nextCursor: null })
    if (path === '/api/correction-requests/mine') return ok([state.request])
    if (path.startsWith('/api/correction-requests/')) {
      if (method === 'PATCH') Object.assign(state.request, req.postDataJSON())
      return ok({ ...state.request, id: path.split('/').at(-1) })
    }
    if (path.startsWith('/api/corrections/request/')) return ok(state.corrections)
    if (path === '/api/sessions') return ok([{ id: 'session-1', title: 'My practice', memberIds: [state.viewer], createdBy: state.viewer }])
    if (path === '/api/sessions/session-1/cards') return ok({ id: 'saved-card' })
    if (path === '/api/storage/presigned-download') return ok({ downloadUrl: 'http://127.0.0.1:3100/flow-audio.wav' })
    if (path === '/api/storage/presigned-upload') return ok({ audioKey: 'audio/reference.webm', uploadUrl: 'http://127.0.0.1:3100/flow-upload' })
    if (path === '/api/practice-feedback' || path === '/api/friends/sent') return ok({ items: [], nextPage: null })
    return ok([])
  })
  await page.route('**/flow-audio.wav', route => state.fail.has('audio')
    ? route.fulfill({ status: 403, body: 'expired' }) : route.fulfill({ contentType: 'audio/wav', body: wav() }))
  await page.route('**/flow-upload', route => { state.uploads++; return route.fulfill({ status: 200 }) })
  return state
}

