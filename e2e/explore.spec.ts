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

/** First article below the sticky header and its viewport offset. */
const firstVisibleArticle = (page: Page) =>
  page.evaluate(() => {
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

const articleTop = (page: Page, id: string) =>
  page.evaluate(
    (articleId) =>
      [...document.querySelectorAll<HTMLElement>('[data-article-id]')]
        .find((el) => el.dataset.articleId === articleId)!
        .getBoundingClientRect().top,
    id,
  )

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
  const anchor = await firstVisibleArticle(page)

  await loadMore.click()
  await expect.poll(() => countOf(page)).toBeGreaterThan(before)
  expect(
    Math.abs((await articleTop(page, anchor.id)) - anchor.top),
  ).toBeLessThanOrEqual(2)
})

for (const scrollWhilePending of [false, true]) {
  const when = scrollWhilePending
    ? 'after scrolling during the request'
    : 'when newer articles insert above'

  test(`Load more keeps the reading position ${when}`, async ({ page }) => {
    const providers = [
      ['guardian', 'The Guardian'],
      ['nyt', 'The New York Times'],
      ['newsapi', 'Wire Desk'],
    ] as const
    const at = (minutes: number) =>
      new Date(Date.UTC(2026, 9, 19, 12) + minutes * 60_000).toISOString()
    const story = (
      id: string,
      providerId: string,
      publisherName: string,
      minutes: number,
    ) => ({
      id,
      canonicalUrl: `https://news.test/${id}`,
      url: `https://news.test/${id}`,
      title: `Story ${id}`,
      publishedAt: at(minutes),
      authors: [],
      providerId,
      publisherName,
      categoryBasis: 'unknown',
    })
    const statuses = providers.map(([providerId]) => ({
      providerId,
      state: 'ok',
      rawCount: 10,
      matchedCount: 10,
      notes: [],
    }))
    // Page 1: 30 unique articles. Page 2: six newer ones that sort above all of them.
    const first = providers.flatMap(([id, name], p) =>
      Array.from({ length: 10 }, (_, i) =>
        story(`${id}-${i}`, id, name, -(i * 3 + p)),
      ),
    )
    const second = Array.from({ length: 6 }, (_, i) =>
      story(`newer-${i}`, 'guardian', 'The Guardian', 60 + i),
    )

    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/feed**', async (route) => {
      const cursor = new URL(route.request().url()).searchParams.get('cursor')
      if (cursor) await held
      await route.fulfill({
        json: {
          mode: 'demo',
          articles: cursor ? second : first,
          providerStatuses: statuses,
          nextCursor: cursor ? 'cursor-3' : 'cursor-2',
        },
      })
    })

    await openExplore(page)
    await expect(results(page)).toHaveText('Showing 30 articles')
    const loadMore = page.getByRole('button', { name: 'Load more' })
    await loadMore.scrollIntoViewIfNeeded()
    await loadMore.click()
    await expect(results(page)).toHaveText(/loading more/)

    if (scrollWhilePending) {
      // The user keeps reading upward while the request is pending.
      await page.evaluate(() => window.scrollBy(0, -1000))
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0)
    }
    const anchor = await firstVisibleArticle(page)

    release()
    await expect(results(page)).toHaveText('Showing 36 articles')
    expect(
      Math.abs((await articleTop(page, anchor.id)) - anchor.top),
    ).toBeLessThanOrEqual(2)
  })
}

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
    () => document.documentElement.scrollWidth - 320,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('a long applied search stays within 320px and remains removable', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Checked on the mobile project.')
  const longQuery = 'a'.repeat(100)
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(`/explore?q=${longQuery}&category=health`)

  const chip = page.getByRole('button', {
    name: `Remove filter “${longQuery}”`,
  })
  await expect(chip).toBeVisible()
  await expect(page.getByText('No articles match these filters.')).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - 320,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  const box = await chip.boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)

  await chip.click()
  await expect(page).toHaveURL(/\/explore\?category=health$/)

  await page.goto(`/explore?q=${longQuery}&source=guardian`)
  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page).toHaveURL(/\/explore$/)
})

test('cards show loaded images and fall back for missing or broken ones', async ({
  page,
}) => {
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  )
  await page.route('https://img.test/ok.png', (route) =>
    route.fulfill({ body: pixel, contentType: 'image/png' }),
  )
  await page.route('https://img.test/broken.png', (route) =>
    route.fulfill({ status: 404, body: '' }),
  )
  const story = (id: string, imageUrl?: string) => ({
    id,
    canonicalUrl: `https://news.test/${id}`,
    url: `https://news.test/${id}`,
    title: `Story ${id}`,
    publishedAt: '2026-10-19T08:00:00.000Z',
    authors: [],
    providerId: 'guardian',
    publisherName: 'The Guardian',
    categoryBasis: 'unknown',
    ...(imageUrl && { imageUrl }),
  })
  await page.route('**/api/feed**', (route) =>
    route.fulfill({
      json: {
        mode: 'demo',
        articles: [
          story('loaded', 'https://img.test/ok.png'),
          story('broken', 'https://img.test/broken.png'),
          story('missing'),
        ],
        providerStatuses: [],
        nextCursor: null,
      },
    }),
  )

  await openExplore(page)
  const card = (id: string) => page.locator(`[data-article-id="${id}"]`)
  await expect(card('loaded').locator('img')).toHaveJSProperty('complete', true)
  expect(
    await card('loaded')
      .locator('img')
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0)
  await expect(card('broken').locator('img')).toHaveCount(0)
  await expect(card('missing').locator('img')).toHaveCount(0)
  await expect(card('broken').locator('svg.lucide-newspaper')).toBeVisible()
  await expect(card('missing').locator('svg.lucide-newspaper')).toBeVisible()
})

test('touch controls for search and applied filters are about 44px', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Touch target sizes are checked on the mobile project.')
  await openExplore(page, '/explore?q=flood&category=health')
  for (const name of [
    'Clear search',
    'Remove filter “flood”',
    'Remove filter Health',
    'Clear all',
  ]) {
    const box = await page.getByRole('button', { name }).boundingBox()
    expect(box!.height, name).toBeGreaterThanOrEqual(44)
  }
})

for (const stayed of [true, false]) {
  test(`final Load more ${stayed ? 'keeps focus in the footer' : 'does not take focus back after the user moved away'}`, async ({
    page,
  }) => {
    const story = (id: string, minutes: number) => ({
      id,
      canonicalUrl: `https://news.test/${id}`,
      url: `https://news.test/${id}`,
      title: `Story ${id}`,
      publishedAt: new Date(
        Date.UTC(2026, 9, 19, 12) + minutes * 60_000,
      ).toISOString(),
      authors: [],
      providerId: 'guardian',
      publisherName: 'The Guardian',
      categoryBasis: 'unknown',
    })
    const statuses = (state: string) =>
      ['guardian', 'nyt', 'newsapi'].map((providerId) => ({
        providerId,
        state,
        rawCount: 1,
        matchedCount: 1,
        notes: [],
      }))

    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/feed**', async (route) => {
      const cursor = new URL(route.request().url()).searchParams.get('cursor')
      if (cursor) await held
      await route.fulfill({
        json: {
          mode: 'demo',
          articles: [cursor ? story('older', -60) : story('newest', 0)],
          providerStatuses: statuses(cursor ? 'exhausted' : 'ok'),
          nextCursor: cursor ? null : 'cursor-2',
        },
      })
    })

    await openExplore(page)
    await page.getByRole('button', { name: 'Load more' }).focus()
    await page.keyboard.press('Enter')
    await expect(results(page)).toHaveText(/loading more/)
    if (!stayed) {
      // Like clicking blank, non-focusable space: focus goes to the body and
      // the blur has no related target, as when an element is removed.
      await page.evaluate(() => (document.activeElement as HTMLElement).blur())
    }
    const focusedTag = () =>
      page.evaluate(() => document.activeElement?.tagName ?? '')
    const before = await focusedTag()
    expect(before).toBe(stayed ? 'BUTTON' : 'BODY')

    release()
    const end = page.getByText('You’ve reached the end of these results.')
    await expect(end).toBeVisible()
    if (stayed) await expect(end.locator('..')).toBeFocused()
    else expect(await focusedTag()).toBe(before)
  })
}
