import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { article, feedPage, status } from '@/test/articles'
import { batch, feedHandler, feedRequests, pagedFeed, sleep } from '@/test/feed'
import { demoHealth } from '@/test/handlers'
import { setDesktop } from '@/test/media'
import { renderApp } from '@/test/render-app'
import { server } from '@/test/server'

const search = (router: { state: { location: { search: string } } }) =>
  router.state.location.search
const queriesSent = (key: string) =>
  feedRequests.map((url) => url.searchParams.get(key))
const filterChip = (name: string) => screen.getByRole('button', { name })
const renderExplore = async (path = '/explore') => renderApp(path)

describe('Explore URL state', () => {
  it('sanitizes invalid URL values once and keeps the valid ones', async () => {
    const { router } = await renderExplore(
      '/explore?source=bbc&source=nyt&from=2026-02-30&category=sports&author=Jane',
    )

    await waitFor(() =>
      expect(search(router)).toBe('?source=nyt&category=sports'),
    )
    expect(filterChip('The New York Times')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(filterChip('Sports')).toHaveAttribute('aria-pressed', 'true')
    await screen.findByText(/Showing 2 articles/)
    expect(feedRequests.map((url) => url.search)).toEqual([
      '?source=nyt&category=sports',
    ])
  })

  it('restores filters and controls on Back and Forward', async () => {
    const { router, user } = await renderExplore()
    await screen.findByText(/Showing 2 articles/)

    await user.click(filterChip('Health'))
    await user.type(
      screen.getByRole('searchbox', { name: 'Search articles' }),
      'rail{Enter}',
    )
    await waitFor(() => expect(search(router)).toBe('?q=rail&category=health'))

    await act(() => router.navigate(-1))
    expect(search(router)).toBe('?category=health')
    expect(screen.getByRole('searchbox')).toHaveValue('')

    await act(() => router.navigate(-1))
    expect(search(router)).toBe('')
    expect(filterChip('Health')).toHaveAttribute('aria-pressed', 'false')

    await act(() => router.navigate(2))
    expect(screen.getByRole('searchbox')).toHaveValue('rail')
    expect(filterChip('Health')).toHaveAttribute('aria-pressed', 'true')
  })

  it('lists applied filters and clears them', async () => {
    const { router, user } = await renderExplore(
      '/explore?q=storm&source=guardian',
    )
    const applied = await screen.findByRole('button', {
      name: 'Remove filter The Guardian',
    })

    await user.click(applied)
    expect(search(router)).toBe('?q=storm')

    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(search(router)).toBe('')
  })
})

describe('Explore search', () => {
  it('debounces typing into a single request', async () => {
    const { router, user } = await renderExplore()
    await screen.findByText(/Showing 2 articles/)

    await user.type(screen.getByRole('searchbox'), 'flood')
    expect(search(router)).toBe('')

    await waitFor(() => expect(search(router)).toBe('?q=flood'))
    await waitFor(() => expect(queriesSent('q')).toEqual([null, 'flood']))
    await act(() => sleep(450))
    expect(queriesSent('q')).toEqual([null, 'flood'])
  })

  it('applies on Enter immediately and cancels the pending debounce', async () => {
    const { router, user } = await renderExplore()
    await screen.findByText(/Showing 2 articles/)

    await user.type(screen.getByRole('searchbox'), 'rail{Enter}')
    expect(search(router)).toBe('?q=rail')
    const entries = router.state.location.key

    await act(() => sleep(500))
    expect(router.state.location.key).toBe(entries)
    expect(queriesSent('q')).toEqual([null, 'rail'])
  })

  it('never shows a slow response for an older keyword', async () => {
    server.use(
      feedHandler(async (url) => {
        const q = url.searchParams.get('q')
        if (q === 'slow') await sleep(300)
        return feedPage({
          articles: [article({ id: q ?? 'none', title: `Result for ${q}` })],
        })
      }),
    )
    const { user } = await renderExplore()
    const box = screen.getByRole('searchbox')

    await user.type(box, 'slow{Enter}')
    await user.clear(box)
    await user.type(box, 'fast{Enter}')

    expect(await screen.findByText('Result for fast')).toBeInTheDocument()
    await act(() => sleep(400))
    expect(screen.queryByText('Result for slow')).not.toBeInTheDocument()
  })
})

describe('Explore desktop filters', () => {
  it('apply immediately and do not request an invalid date range', async () => {
    const { router, user } = await renderExplore()
    await screen.findByText(/Showing 2 articles/)

    await user.click(filterChip('The Guardian'))
    expect(search(router)).toBe('?source=guardian')

    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2026-10-10' },
    })
    expect(search(router)).toBe('?from=2026-10-10&source=guardian')

    const to = screen.getByLabelText('To')
    fireEvent.change(to, { target: { value: '2026-10-01' } })
    const error = screen.getByText(
      'The start date must be on or before the end date.',
    )
    expect(to).toHaveAttribute('aria-invalid', 'true')
    expect(to.getAttribute('aria-describedby')).toContain(error.id)
    expect(search(router)).toBe('?from=2026-10-10&source=guardian')

    await act(() => sleep(50))
    expect(
      feedRequests.some((url) => url.searchParams.get('to') === '2026-10-01'),
    ).toBe(false)
  })
})

describe('Explore mobile filters', () => {
  it('keep a draft that only Apply commits', async () => {
    setDesktop(false)
    const { router, user } = await renderExplore('/explore?category=sports')
    await screen.findByText(/Showing 2 articles/)
    const openSheet = () =>
      user.click(screen.getByRole('button', { name: /^Filters/ }))

    await openSheet()
    let sheet = screen.getByRole('dialog', { name: 'Filters' })
    await user.click(within(sheet).getByRole('button', { name: 'Health' }))
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    expect(search(router)).toBe('?category=sports')

    await openSheet()
    sheet = screen.getByRole('dialog', { name: 'Filters' })
    expect(
      within(sheet).getByRole('button', { name: 'Health' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(sheet).getByRole('button', { name: 'Reset' }))
    expect(
      within(sheet).getByRole('button', { name: 'Sports' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await user.keyboard('{Escape}')
    expect(search(router)).toBe('?category=sports')

    await openSheet()
    sheet = screen.getByRole('dialog', { name: 'Filters' })
    await user.click(
      within(sheet).getByRole('button', { name: 'The Guardian' }),
    )
    await user.click(within(sheet).getByRole('button', { name: 'Apply' }))
    expect(search(router)).toBe('?source=guardian&category=sports')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('blocks Apply while the date range is invalid', async () => {
    setDesktop(false)
    const { router, user } = await renderExplore()
    await screen.findByText(/Showing 2 articles/)

    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    const sheet = screen.getByRole('dialog', { name: 'Filters' })
    fireEvent.change(within(sheet).getByLabelText('From'), {
      target: { value: '2026-10-10' },
    })
    fireEvent.change(within(sheet).getByLabelText('To'), {
      target: { value: '2026-10-01' },
    })

    expect(within(sheet).getByRole('button', { name: 'Apply' })).toBeDisabled()
    expect(
      within(sheet).getByText(
        'The start date must be on or before the end date.',
      ),
    ).toBeInTheDocument()
    expect(search(router)).toBe('')
    expect(feedRequests).toHaveLength(1)
  })
})

describe('Explore pagination', () => {
  const twoPages = () =>
    pagedFeed([
      feedPage({ articles: batch('first', 12) }),
      feedPage({ articles: batch('second', 10) }),
    ])

  it('loads the next page with the server cursor and ignores double clicks', async () => {
    server.use(feedHandler(twoPages()))
    const { user } = await renderExplore()
    await screen.findByText('Showing 10 articles')

    const loadMore = screen.getByRole('button', { name: 'Load more' })
    await user.dblClick(loadMore)

    await screen.findByText('Showing 20 articles')
    expect(queriesSent('cursor')).toEqual([null, 'page-2'])
    expect(
      screen.getByText('You’ve reached the end of these results.'),
    ).toBeInTheDocument()
  })

  it('keeps loaded articles after a failed page and retries the same cursor', async () => {
    let failNext = true
    const pages = twoPages()
    server.use(
      feedHandler((url) => {
        if (url.searchParams.get('cursor') && failNext) {
          failNext = false
          return HttpResponse.json(
            { error: { code: 'internal_error', message: 'Boom.' } },
            { status: 500 },
          )
        }
        return pages(url)
      }),
    )
    const { user } = await renderExplore()
    await screen.findByText('Showing 10 articles')

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(
      await screen.findByText(/Couldn’t load more articles/),
    ).toBeInTheDocument()
    expect(screen.getByText('first story 0')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Showing 20 articles')
    expect(queriesSent('cursor')).toEqual([null, 'page-2', 'page-2'])
  })

  it('offers Refresh, not a retry of the same cursor, when the cursor is rejected', async () => {
    const pages = twoPages()
    server.use(
      feedHandler((url) =>
        url.searchParams.get('cursor')
          ? HttpResponse.json(
              {
                error: { code: 'invalid_cursor', message: 'Cursor rejected.' },
              },
              { status: 400 },
            )
          : pages(url),
      ),
    )
    const { user } = await renderExplore('/explore?category=health')
    await screen.findByText('Showing 10 articles')

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(
      await screen.findByText(/These results are out of date/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('first story 0')).toBeInTheDocument()

    const refreshButtons = screen.getAllByRole('button', { name: 'Refresh' })
    await user.click(refreshButtons.at(-1)!)
    await screen.findByText('Showing 10 articles')
    expect(feedRequests.map((url) => url.search)).toEqual([
      '?category=health',
      '?category=health&cursor=page-2',
      '?category=health',
    ])
  })

  it('refresh restarts from the first page only', async () => {
    server.use(feedHandler(twoPages()))
    const { user } = await renderExplore()
    await screen.findByText('Showing 10 articles')
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Showing 20 articles')

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await screen.findByText('Showing 10 articles')
    expect(queriesSent('cursor')).toEqual([null, 'page-2', null])
  })

  it('explains a sparse batch and keeps Load more available', async () => {
    server.use(
      feedHandler(
        pagedFeed([
          feedPage({ articles: batch('first', 12) }),
          feedPage({ articles: [] }),
          feedPage({ articles: batch('third', 8) }),
        ]),
      ),
    )
    const { user } = await renderExplore()
    await screen.findByText('Showing 10 articles')
    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(
      await screen.findByText(/The last batch had no new articles/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Showing 20 articles')
  })

  it('reports paused providers and does not claim the end of all sources', async () => {
    const paused = status('nyt', {
      state: 'paused',
      rawCount: 0,
      matchedCount: 0,
      error: {
        code: 'rate_limited',
        message: 'The provider rate limit was reached. Try again later.',
      },
    })
    server.use(
      feedHandler(() =>
        feedPage({
          articles: batch('first', 12, 3),
          providerStatuses: [
            status('guardian', { state: 'exhausted' }),
            paused,
            status('newsapi', { state: 'exhausted' }),
          ],
        }),
      ),
    )
    await renderExplore()

    expect(
      await screen.findByText('Some sources are unavailable'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'The New York Times: The provider rate limit was reached. Try again later.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/paused during this search/)).toBeInTheDocument()
    expect(
      screen.queryByText('You’ve reached the end of these results.'),
    ).not.toBeInTheDocument()
  })

  it('shows provider notes in plain language', async () => {
    server.use(
      feedHandler(() =>
        feedPage({
          articles: batch('first', 12, 2),
          providerStatuses: [
            status('newsapi', { notes: ['publisher_categories'] }),
          ],
        }),
      ),
    )
    await renderExplore('/explore?category=sports')
    expect(
      await screen.findByText(
        'NewsAPI categories describe the publisher, not each article.',
      ),
    ).toBeInTheDocument()
  })
})

describe('Explore empty and error states', () => {
  it('offers to clear filters when nothing matches', async () => {
    server.use(feedHandler(() => feedPage()))
    const { router, user } = await renderExplore('/explore?q=nothing')

    await screen.findByText('No articles match these filters.')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(search(router)).toBe('')
  })

  it('explains a full provider failure with a manual retry', async () => {
    server.use(
      feedHandler(() =>
        HttpResponse.json(
          {
            error: { code: 'all_providers_failed', message: 'None.' },
            providerStatuses: [
              status('guardian', {
                state: 'paused',
                rawCount: 0,
                matchedCount: 0,
                error: {
                  code: 'unauthorized',
                  message: 'The provider rejected the API key.',
                },
              }),
            ],
          },
          { status: 503 },
        ),
      ),
    )
    await renderExplore()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'None of the news sources could be reached.',
    )
    expect(alert).toHaveTextContent(
      'The Guardian: The provider rejected the API key.',
    )
    expect(
      within(alert).getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
  })

  it('does not offer a retry for missing Live configuration', async () => {
    server.use(
      feedHandler(() =>
        HttpResponse.json(
          { error: { code: 'configuration_error', message: 'Keys.' } },
          { status: 503 },
        ),
      ),
    )
    await renderExplore()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Live news isn’t configured on this server.',
    )
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  it('waits for the server mode and reports a health failure without requesting the feed', async () => {
    server.use(
      http.get('*/api/health', () => HttpResponse.json({}, { status: 500 })),
    )
    await renderExplore()

    expect(
      await screen.findByText('Couldn’t reach the News Desk server.'),
    ).toBeInTheDocument()
    expect(feedRequests).toHaveLength(0)
  })

  it('does not request the feed when Live mode is not ready', async () => {
    server.use(
      http.get('*/api/health', () =>
        HttpResponse.json({ ...demoHealth, mode: 'live', ready: false }),
      ),
    )
    await renderExplore()

    expect(
      await screen.findByText('Live news isn’t configured on this server.'),
    ).toBeInTheDocument()
    expect(feedRequests).toHaveLength(0)
  })
})
