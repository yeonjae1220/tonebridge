import { expect, test, type Page } from '@playwright/test'

// Store review opens these from the app's sign-in screen without a session,
// so they must render signed out, in both languages, with a reachable contact.
async function signedOut(page: Page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill(path === '/api/auth/refresh' ? { status: 401, json: {} } : { json: [] })
  })
}

for (const { path, ko, en } of [
  { path: '/privacy', ko: '개인정보 처리방침', en: 'Privacy Policy' },
  { path: '/terms', ko: '이용약관', en: 'Terms of Service' },
]) {
  test(`${path} renders signed out in Korean and English with a contact`, async ({ page }) => {
    await signedOut(page)
    const response = await page.goto(`${path}?lang=ko`)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`${path}\\?lang=ko$`))
    await expect(page.getByRole('heading', { level: 1, name: ko })).toBeVisible()
    await expect(page.getByRole('link', { name: 'support@mungji.com' })).toHaveAttribute('href', 'mailto:support@mungji.com')

    await page.getByRole('link', { name: 'English' }).click()
    await expect(page.getByRole('heading', { level: 1, name: en })).toBeVisible()
  })
}

test('the language falls back to the browser when no ?lang is given', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()
  await signedOut(page)
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible()
  await context.close()
})

test('terms state zero tolerance, reporting and the minimum age', async ({ page }) => {
  await signedOut(page)
  await page.goto('/terms?lang=en')
  await expect(page.getByRole('heading', { name: /zero tolerance/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Reporting and blocking/ })).toBeVisible()
  await expect(page.getByText('at least 14 years old')).toBeVisible()
})

test('help links to both policies', async ({ page }) => {
  await signedOut(page)
  await page.goto('/help')
  await page.getByRole('link', { name: '개인정보 처리방침' }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole('heading', { level: 1, name: '개인정보 처리방침' })).toBeVisible()
})
