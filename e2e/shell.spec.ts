import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const pages = [
  { path: '/explore', heading: 'Explore' },
  { path: '/my-feed', heading: 'My Feed' },
  { path: '/preferences', heading: 'Preferences' },
]

async function navigateTo(page: Page, isMobile: boolean, label: string) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
  }
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: label })
    .click()
}

test('redirects the root path to Explore in Demo mode', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/explore$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Explore' }),
  ).toBeVisible()
  await expect(
    page.getByText('Demo data').filter({ visible: true }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Explore · News Aggregator')
})

test('serves deep links and supports Back/Forward', async ({
  page,
  isMobile,
}) => {
  await page.goto('/preferences')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Preferences' }),
  ).toBeVisible()

  await navigateTo(page, isMobile, 'My Feed')
  await expect(page).toHaveURL(/\/my-feed$/)

  await page.goBack()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Preferences' }),
  ).toBeVisible()
  await page.goForward()
  await expect(
    page.getByRole('heading', { level: 1, name: 'My Feed' }),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'My Feed' }),
  ).toBeVisible()
})

test('mobile navigation sheet closes after choosing a page', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The navigation sheet is only used below 1024px.')
  await page.goto('/explore')

  const trigger = page.getByRole('button', { name: 'Open navigation' })
  await trigger.click()
  const sheet = page.getByRole('dialog', { name: 'News Aggregator' })
  await expect(sheet).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(trigger).toBeFocused()

  await trigger.click()
  await sheet.getByRole('link', { name: 'Preferences' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/\/preferences$/)
})

test('skip link moves focus to the main content', async ({ page }) => {
  await page.goto('/explore')

  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Skip to main content' })
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})

test('shows a not-found page for unknown routes', async ({ page }) => {
  await page.goto('/unknown-page')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Page not found' }),
  ).toBeVisible()
})

test('keeps unknown API routes as JSON 404', async ({ request }) => {
  const response = await request.get('/api/unknown')

  expect(response.status()).toBe(404)
  expect(await response.json()).toMatchObject({
    error: { code: 'not_found' },
  })
})

test('has no horizontal overflow on narrow screens', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Checked at 320px on the mobile project.')
  await page.setViewportSize({ width: 320, height: 640 })

  for (const { path } of pages) {
    await page.goto(path)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - 320,
    )
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

for (const { path, heading } of pages) {
  test(`${heading} has no serious accessibility violations`, async ({
    page,
  }) => {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
    await expect(
      page.getByText('Demo data').filter({ visible: true }),
    ).toBeVisible()

    const { violations } = await new AxeBuilder({ page }).analyze()
    const blocking = violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
}

test('serves the Demo feed with a pagination cursor', async ({ request }) => {
  const response = await request.get('/api/feed?source=guardian')
  expect(response.status()).toBe(200)

  const body = await response.json()
  expect(body).toMatchObject({ mode: 'demo' })
  expect(body.articles).toHaveLength(10)
  expect(typeof body.nextCursor).toBe('string')
})
