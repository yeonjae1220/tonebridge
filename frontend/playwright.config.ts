import { defineConfig, devices } from '@playwright/test'

// First run: npx playwright install --with-deps chromium
// API responses and microphone input are fixtures; no live account or service is used.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    locale: 'ko-KR',
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-layout', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // Exercise the production CSP and bundle; development eval is blocked by the app's CSP.
    command: 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
})
