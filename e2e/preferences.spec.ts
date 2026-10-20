import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const LONG_AUTHOR =
  'Maximiliana Alexandrina Konstantinopoulou-Wolfeschlegelsteinhausenbergerdorff'

async function goTo(page: Page, isMobile: boolean, label: string) {
  if (isMobile)
    await page.getByRole('button', { name: 'Open navigation' }).click()
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: label })
    .click()
}

async function expectNoSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const blocking = violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

const feedStatus = (page: Page) =>
  page.getByRole('status').filter({ hasText: /Showing \d+ article/ })

test('saved preferences drive My Feed and survive a reload', async ({
  page,
  isMobile,
}) => {
  await page.goto('/preferences')
  await page.getByRole('button', { name: 'The Guardian' }).click()
  await page.getByRole('button', { name: 'Health' }).click()
  await page.getByRole('textbox', { name: 'Author name' }).fill('Amelia Hart')
  await page.getByRole('textbox', { name: 'Author name' }).press('Enter')
  await expect(page.getByText('You have unsaved changes.')).toBeVisible()

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Preferences saved.' }),
  ).toBeVisible()

  const request = page.waitForRequest((r) => r.url().includes('/api/feed'))
  await goTo(page, isMobile, 'My Feed')
  expect(new URL((await request).url()).search).toBe(
    '?source=guardian&category=health&author=Amelia+Hart',
  )
  await expect(feedStatus(page)).toBeVisible()
  await expect(
    page.getByText('The Guardian', { exact: true }).first(),
  ).toBeVisible()

  await page.reload()
  await expect(page.getByText('Amelia Hart').first()).toBeVisible()
  await expect(feedStatus(page)).toBeVisible()
  await expectNoSeriousViolations(page)
})

test('Cancel and Reset never change the applied preferences', async ({
  page,
}) => {
  await page.goto('/preferences')
  await page.getByRole('button', { name: 'The New York Times' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  const nyt = page.getByRole('button', { name: 'The New York Times' })
  const guardian = page.getByRole('button', { name: 'The Guardian' })

  await guardian.click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(guardian).toHaveAttribute('aria-pressed', 'false')
  await expect(nyt).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(nyt).toHaveAttribute('aria-pressed', 'false')
  await page.goto('/my-feed')
  await expect(
    page.getByText('The New York Times', { exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByText('Set up your feed')).toHaveCount(0)
})

test('authors can be added and removed with the keyboard', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Keyboard flow is checked on desktop.')
  await page.goto('/preferences')
  const input = page.getByRole('textbox', { name: 'Author name' })

  await input.focus()
  await page.keyboard.type('Doe, Jane')
  await page.keyboard.press('Enter')
  const remove = page.getByRole('button', { name: 'Remove Doe, Jane' })
  await expect(remove).toBeVisible()
  await expect(input).toHaveValue('')

  await remove.focus()
  await expect(remove).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('No authors selected.')).toBeVisible()
})

test('long selections fit a 320px screen on Preferences and My Feed', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Checked on the mobile project.')
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/preferences')

  for (const name of [
    'General',
    'Business',
    'Technology',
    'Science',
    'Health',
    'Sports',
    'Entertainment',
  ]) {
    await page.getByRole('button', { name, exact: true }).click()
  }
  await page.getByRole('textbox', { name: 'Author name' }).fill(LONG_AUTHOR)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(
    page.getByRole('button', { name: `Remove ${LONG_AUTHOR}` }),
  ).toBeVisible()
  // Compare against the intended width; mobile emulation can widen innerWidth.
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - 320)
  expect(await overflow()).toBeLessThanOrEqual(0)
  await expectNoSeriousViolations(page)

  await page.getByRole('button', { name: 'Save' }).click()
  await page.goto('/my-feed')
  await expect(page.getByText(LONG_AUTHOR)).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})

test('My Feed asks for preferences before showing any articles', async ({
  page,
}) => {
  let feedRequests = 0
  page.on('request', (r) => {
    if (r.url().includes('/api/feed')) feedRequests++
  })
  await page.goto('/my-feed')
  await expect(
    page.getByRole('heading', { name: 'Set up your feed' }),
  ).toBeVisible()
  await expectNoSeriousViolations(page)
  expect(feedRequests).toBe(0)
})

test('blocked storage keeps saved preferences for the session and says so', async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage blocked', 'QuotaExceededError')
    }
  })
  await page.goto('/preferences')
  await page.getByRole('button', { name: 'The Guardian' }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(
    page.getByRole('status').filter({
      hasText:
        'Preferences applied to My Feed. Changes are not persisted on this device.',
    }),
  ).toBeVisible()
  await expect(page.getByText('Preferences saved.')).toHaveCount(0)
  // The pointer still rests on Save, so its hover colour is checked too.
  await expectNoSeriousViolations(page)

  await goTo(page, isMobile, 'My Feed')
  await expect(
    page.getByText('The Guardian', { exact: true }).first(),
  ).toBeVisible()
  await expect(feedStatus(page)).toBeVisible()
})

test('author remove buttons are about 44px on touch screens', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Touch target sizes are checked on the mobile project.')
  await page.goto('/preferences')
  await page.getByRole('textbox', { name: 'Author name' }).fill('Jane Doe')
  await page.getByRole('textbox', { name: 'Author name' }).press('Enter')
  const box = await page
    .getByRole('button', { name: 'Remove Jane Doe' })
    .boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.width).toBeGreaterThanOrEqual(44)
})
