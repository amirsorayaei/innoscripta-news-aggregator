import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const results = (page: Page) =>
  page.getByRole('status').filter({ hasText: /Showing \d+ article/ })
const countOf = async (page: Page) =>
  Number((await results(page).textContent())?.match(/Showing (\d+)/)?.[1])

async function openExplore(page: Page, path = '/explore') {
  await page.goto(path)
  await expect(results(page)).toBeVisible()
}

async function expectNoSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const blocking = violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

test('search updates the URL, survives reload and goes Back', async ({
  page,
}) => {
  await openExplore(page)
  const box = page.getByRole('searchbox', { name: 'Search articles' })

  await box.fill('flood')
  await expect(page).toHaveURL(/\/explore\?q=flood$/)
  await expect(
    page
      .getByRole('link', { name: /Coastal towns trial shared flood barriers/ })
      .first(),
  ).toBeVisible()

  await page.reload()
  await expect(page.getByRole('searchbox')).toHaveValue('flood')
  await expect(results(page)).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/explore$/)
  await expect(page.getByRole('searchbox')).toHaveValue('')
})

test('invalid URL values are dropped without losing valid filters', async ({
  page,
}) => {
  await openExplore(page, '/explore?source=bbc&from=2026-02-30&category=health')
  await expect(page).toHaveURL(/\/explore\?category=health$/)
  await expect(
    page.getByRole('button', { name: 'Remove filter Health' }),
  ).toBeVisible()
})

test('desktop category filters apply immediately', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Inline filters are desktop-only.')
  await openExplore(page)

  await page.getByRole('button', { name: 'Health', exact: true }).click()
  await expect(page).toHaveURL(/category=health/)
  await expect(results(page)).toBeVisible()
  const tags = page.locator('article').getByText(/^Health/)
  await expect(tags.first()).toBeVisible()
  expect(await tags.count()).toBe(await page.locator('article').count())
})

test('Load more fetches the next page and keeps the reading position', async ({
  page,
}) => {
  await openExplore(page)
  const before = await countOf(page)
  const loadMore = page.getByRole('button', { name: 'Load more' })
  await loadMore.scrollIntoViewIfNeeded()

  const anchor = await page.evaluate(() => {
    const header = document.querySelector('[data-sticky-header]')
    const top = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
    const first = [
      ...document.querySelectorAll<HTMLElement>('[data-article-id]'),
    ].find((el) => el.getBoundingClientRect().bottom > top)!
    return {
      id: first.dataset.articleId!,
      top: first.getBoundingClientRect().top,
    }
  })

  await loadMore.click()
  await expect.poll(() => countOf(page)).toBeGreaterThan(before)

  const after = await page.evaluate(
    (id) =>
      [...document.querySelectorAll<HTMLElement>('[data-article-id]')]
        .find((el) => el.dataset.articleId === id)!
        .getBoundingClientRect().top,
    anchor.id,
  )
  expect(Math.abs(after - anchor.top)).toBeLessThanOrEqual(2)
})

test('mobile filter Sheet keeps a draft until Apply', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The filter Sheet is used below 1024px.')
  await openExplore(page)
  const open = () => page.getByRole('button', { name: /^Filters/ }).click()

  await open()
  const sheet = page.getByRole('dialog', { name: 'Filters' })
  await sheet.getByRole('button', { name: 'Science' }).click()
  // The navigation Sheet cannot be opened while the filter Sheet is open.
  await expect(
    page.getByRole('button', { name: 'Open navigation' }),
  ).toHaveCount(0)
  await expectNoSeriousViolations(page)

  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/\/explore$/)
  await expect(page.getByRole('button', { name: /^Filters/ })).toBeFocused()

  await open()
  await expect(sheet.getByRole('button', { name: 'Science' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await sheet.getByRole('button', { name: 'Science' }).click()
  await sheet.getByRole('button', { name: 'Apply' }).click()
  await expect(page).toHaveURL(/\/explore\?category=science$/)
  await expect(results(page)).toBeVisible()
})

test('Explore with results has no serious accessibility violations', async ({
  page,
}) => {
  await openExplore(page)
  await expectNoSeriousViolations(page)
})

test('Explore results do not overflow at 320px', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Checked on the mobile project.')
  await page.setViewportSize({ width: 320, height: 640 })
  await openExplore(page, '/explore?category=technology')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
