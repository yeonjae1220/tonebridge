import { test, expect } from '@playwright/test'
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { api, loginWithPassword, registerWithPassword, logout, tryRestoreSession } from '../src/lib/api'
import { useAuthStore } from '../src/stores/authStore'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
function response(config: InternalAxiosRequestConfig, data = {}, status = 200) {
  return { config, data, status, statusText: String(status), headers: {} }
}
function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response(config, {}, 401))
}
const originalAdapter = axios.defaults.adapter
const originalApiAdapter = api.defaults.adapter

test.beforeEach(() => { useAuthStore.getState().beginSession('old-account') })
test.afterEach(() => {
  axios.defaults.adapter = originalAdapter
  api.defaults.adapter = originalApiAdapter
  useAuthStore.getState().logout()
})

test('late 401 cannot replay an old mutation as the new account', async () => {
  const sent = deferred<void>(), release = deferred<void>()
  let writes = 0, refreshes = 0
  api.defaults.adapter = async (config) => {
    writes++
    if (writes === 1) { sent.resolve(); await release.promise; throw unauthorized(config) }
    return response(config)
  }
  axios.defaults.adapter = async (config) => { refreshes++; return response(config, { accessToken: 'refreshed-new-account' }) }
  const pending = api.post('/cards/old-card/attempts', { audioKey: 'old-account.webm' }).catch((e: unknown) => e)
  await sent.promise
  useAuthStore.getState().beginSession('new-account')
  release.resolve()
  expect(await pending).toBeInstanceOf(Error)
  expect(writes).toBe(1)
  expect(refreshes).toBe(0)
  expect(useAuthStore.getState().accessToken).toBe('new-account')
})

for (const fails of [false, true]) {
  test(`old refresh ${fails ? 'failure' : 'success'} cannot alter a new session`, async () => {
    const refreshing = deferred<void>(), release = deferred<void>()
    api.defaults.adapter = async (config) => { throw unauthorized(config) }
    axios.defaults.adapter = async (config) => {
      refreshing.resolve(); await release.promise
      if (fails) throw unauthorized(config)
      return response(config, { accessToken: 'old-refreshed' })
    }
    const pending = api.get('/users/me').catch((e: unknown) => e)
    await refreshing.promise
    useAuthStore.getState().beginSession('new-account')
    release.resolve()
    expect(await pending).toBeInstanceOf(Error)
    expect(useAuthStore.getState().accessToken).toBe('new-account')
  })
}

test('late successful responses are rejected after switching accounts', async () => {
  const sent = deferred<void>(), release = deferred<void>()
  api.defaults.adapter = async (config) => { sent.resolve(); await release.promise; return response(config, { private: 'old-account' }) }
  const pending = api.get('/users/me').catch((e: unknown) => e)
  await sent.promise
  useAuthStore.getState().beginSession('new-account')
  release.resolve()
  expect(await pending).toBeInstanceOf(Error)
})

test('startup restoration cannot overwrite an explicit login', async () => {
  useAuthStore.getState().logout()
  const sent = deferred<void>(), release = deferred<void>()
  axios.defaults.adapter = async (config) => { sent.resolve(); await release.promise; return response(config, { accessToken: 'old-restored' }) }
  const pending = tryRestoreSession()
  await sent.promise
  useAuthStore.getState().beginSession('new-account')
  release.resolve()
  await pending
  expect(useAuthStore.getState().accessToken).toBe('new-account')
})

test('logout invalidates local operations before its network request completes', async () => {
  const sent = deferred<void>(), release = deferred<void>()
  axios.defaults.adapter = async (config) => { sent.resolve(); await release.promise; return response(config) }
  const pending = logout()
  await sent.promise
  const tokenDuringLogout = useAuthStore.getState().accessToken
  useAuthStore.getState().beginSession('new-account')
  release.resolve()
  await pending
  expect(tokenDuringLogout).toBeNull()
  expect(useAuthStore.getState().accessToken).toBe('new-account')
})

test('concurrent 401s in the same account share one refresh and retry with its token', async () => {
  const bothSent = deferred<void>(), release = deferred<void>()
  let initialRequests = 0, refreshes = 0
  api.defaults.adapter = async (config) => {
    if (!config._retry) {
      if (++initialRequests === 2) bothSent.resolve()
      throw unauthorized(config)
    }
    expect(config.headers.Authorization).toBe('Bearer refreshed-account')
    return response(config, { saved: true })
  }
  axios.defaults.adapter = async (config) => {
    refreshes++; await release.promise
    return response(config, { accessToken: 'refreshed-account' })
  }
  const pending = Promise.all([api.get('/users/me'), api.post('/cards/one/attempts', {})])
  await bothSent.promise
  release.resolve()
  expect((await pending).map((res) => res.data.saved)).toEqual([true, true])
  expect(refreshes).toBe(1)
  expect(useAuthStore.getState().accessToken).toBe('refreshed-account')
})

test('a new account can refresh while an obsolete refresh is still settling', async () => {
  const oldRefreshing = deferred<void>(), releaseOld = deferred<void>()
  let refreshes = 0
  api.defaults.adapter = async (config) => {
    if (!config._retry) throw unauthorized(config)
    return response(config, { saved: true })
  }
  axios.defaults.adapter = async (config) => {
    if (++refreshes === 1) { oldRefreshing.resolve(); await releaseOld.promise; return response(config, { accessToken: 'old-refreshed' }) }
    return response(config, { accessToken: 'new-refreshed' })
  }
  const old = api.get('/old').catch((e: unknown) => e)
  await oldRefreshing.promise
  useAuthStore.getState().beginSession('new-account')
  expect((await api.get('/new')).data.saved).toBe(true)
  releaseOld.resolve()
  expect(await old).toBeInstanceOf(Error)
  expect(refreshes).toBe(2)
  expect(useAuthStore.getState().accessToken).toBe('new-refreshed')
})

test('startup restoration deduplicates callers and establishes a session', async () => {
  useAuthStore.getState().logout()
  let refreshes = 0
  axios.defaults.adapter = async (config) => { refreshes++; return response(config, { accessToken: 'restored-account' }) }
  expect(await Promise.all([tryRestoreSession(), tryRestoreSession()])).toEqual([true, true])
  expect(refreshes).toBe(1)
  expect(useAuthStore.getState().accessToken).toBe('restored-account')
})

test('a login response arriving after logout cannot resurrect the session', async () => {
  const sent = deferred<void>(), release = deferred<void>()
  axios.defaults.adapter = async (config) => { sent.resolve(); await release.promise; return response(config, { accessToken: 'obsolete-login' }) }
  const pending = loginWithPassword('test@example.com', 'fixture').catch((e: unknown) => e)
  await sent.promise
  useAuthStore.getState().logout()
  release.resolve()
  expect(await pending).toBeInstanceOf(Error)
  expect(useAuthStore.getState().accessToken).toBeNull()
})

test('a new login waits for logout cookie deletion and restoration stays disabled meanwhile', async () => {
  const sent = deferred<void>(), release = deferred<void>()
  const paths: string[] = []
  axios.defaults.adapter = async (config) => {
    paths.push(config.url!)
    if (config.url === '/api/auth/logout') { sent.resolve(); await release.promise; return response(config) }
    return response(config, { accessToken: 'new-login' })
  }
  const signingOut = logout()
  await sent.promise
  const signingIn = loginWithPassword('new@example.com', 'fixture')
  expect(await tryRestoreSession()).toBe(false)
  expect(paths).toEqual(['/api/auth/logout'])
  release.resolve()
  await Promise.all([signingOut, signingIn])
  expect(paths).toEqual(['/api/auth/logout', '/api/auth/login'])
  expect(useAuthStore.getState().accessToken).toBe('new-login')
})

test('password login cancels an old refresh without expiring the pending login', async () => {
  const refreshing = deferred<void>(), releaseRefresh = deferred<void>()
  const loggingIn = deferred<void>(), releaseLogin = deferred<void>()
  api.defaults.adapter = async (config) => { throw unauthorized(config) }
  axios.defaults.adapter = async (config) => {
    if (config.url === '/api/auth/refresh') {
      refreshing.resolve(); await releaseRefresh.promise
      return response(config, { accessToken: 'old-refreshed' })
    }
    loggingIn.resolve(); await releaseLogin.promise
    return response(config, { accessToken: 'new-login' })
  }
  const oldRequest = api.get('/users/me').catch((e: unknown) => e)
  await refreshing.promise
  const generation = useAuthStore.getState().sessionGeneration
  const login = loginWithPassword('new@example.com', 'fixture')
  await loggingIn.promise
  releaseRefresh.resolve()
  expect(axios.isCancel(await oldRequest)).toBe(true)
  expect(useAuthStore.getState().sessionGeneration).toBe(generation)
  releaseLogin.resolve()
  await login
  expect(useAuthStore.getState().accessToken).toBe('new-login')
})

test('a new signup cancels an older login even without page cleanup', async () => {
  const sent = deferred<void>(), release = deferred<void>()
  let oldConfig: InternalAxiosRequestConfig | undefined
  axios.defaults.adapter = async (config) => {
    if (config.url === '/api/auth/login') {
      oldConfig = config; sent.resolve(); await release.promise
      return response(config, { accessToken: 'old-login' })
    }
    return response(config, { accessToken: 'new-signup' })
  }
  const old = loginWithPassword('old@example.com', 'fixture').catch((e: unknown) => e)
  await sent.promise
  await registerWithPassword('new@example.com', 'fixture', 'fixture')
  expect(oldConfig?.signal?.aborted).toBe(true)
  release.resolve()
  expect(axios.isCancel(await old)).toBe(true)
  expect(useAuthStore.getState().accessToken).toBe('new-signup')
})

test('an already cancelled authentication attempt sends no request', async () => {
  const controller = new AbortController()
  controller.abort()
  let sends = 0
  axios.defaults.adapter = async (config) => { sends++; return response(config, { accessToken: 'unexpected' }) }
  const result = await loginWithPassword('old@example.com', 'fixture', controller.signal).catch((e: unknown) => e)
  expect(axios.isCancel(result)).toBe(true)
  expect(sends).toBe(0)
  expect(useAuthStore.getState().accessToken).toBe('old-account')
})
