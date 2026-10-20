import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { article, feedPage } from '@/test/articles'
import { batch, feedHandler, feedRequests, pagedFeed, sleep } from '@/test/feed'
import { seedPreferences } from '@/test/preferences'
import { renderApp } from '@/test/render-app'
import { server } from '@/test/server'

const searches = () => feedRequests.map((url) => url.search)

describe('My Feed', () => {
  it('asks for preferences and sends no request when none are saved', async () => {
    renderApp('/my-feed')

    expect(await screen.findByText('Set up your feed')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Choose preferences' }),
    ).toHaveAttribute('href', '/preferences')
    await act(() => sleep(50))
    expect(feedRequests).toHaveLength(0)
  })

  it.each([
    ['sources only', { sources: ['nyt' as const] }, '?source=nyt'],
    [
      'categories only',
      { categories: ['science' as const] },
      '?category=science',
    ],
    ['authors only', { authors: ['Jane Doe'] }, '?author=Jane+Doe'],
  ])('requests the feed from %s', async (_label, preferences, search) => {
    seedPreferences(preferences)
    renderApp('/my-feed')
    await waitFor(() => expect(searches()).toEqual([search]))
  })

  it('combines groups exactly and never carries Explore’s keyword or dates', async () => {
    seedPreferences({
      sources: ['newsapi', 'guardian'],
      categories: ['business'],
      authors: ['Doe, Jane', 'Amelia Hart'],
    })
    const { router } = renderApp(
      '/explore?q=storm&from=2026-10-01&category=health',
    )
    await screen.findByText(/Showing \d+ article/)

    await act(() => router.navigate('/my-feed'))
    await waitFor(() =>
      expect(searches().at(-1)).toBe(
        '?source=guardian&source=newsapi&category=business&author=Amelia+Hart&author=Doe%2C+Jane',
      ),
    )
    expect(screen.getByText('Amelia Hart, Doe, Jane')).toBeInTheDocument()
  })

  it('keeps Load more for a sparse author batch without fetching on its own', async () => {
    seedPreferences({ authors: ['Rare Author'] })
    server.use(
      feedHandler(
        pagedFeed([
          feedPage({ articles: [] }),
          feedPage({
            articles: [
              article({
                id: 'r',
                title: 'Rare find',
                authors: ['Rare Author'],
              }),
            ],
          }),
        ]),
      ),
    )
    const { user } = renderApp('/my-feed')

    expect(
      await screen.findByText(/The last batch had no new articles/),
    ).toBeInTheDocument()
    await act(() => sleep(300))
    expect(searches()).toEqual(['?author=Rare+Author'])
    expect(screen.queryByText(/reached the end/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('Rare find')).toBeInTheDocument()
    expect(searches()).toEqual([
      '?author=Rare+Author',
      '?author=Rare+Author&cursor=page-2',
    ])
  })

  it('starts a new stream when the saved preferences change', async () => {
    seedPreferences({ sources: ['guardian'] })
    server.use(
      feedHandler((url) =>
        url.searchParams.get('source') === 'nyt'
          ? feedPage({
              articles: [
                article({
                  id: 'n',
                  title: 'NYT result',
                  providerId: 'nyt',
                  publisherName: 'The New York Times',
                }),
              ],
            })
          : pagedFeed([
              feedPage({ articles: batch('guardian', 12) }),
              feedPage({ articles: batch('older', 10) }),
            ])(url),
      ),
    )
    const { router, user } = renderApp('/my-feed')
    await screen.findByText('Showing 10 articles')
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Showing 20 articles')

    await act(() => router.navigate('/preferences'))
    await user.click(screen.getByRole('button', { name: 'The Guardian' }))
    await user.click(screen.getByRole('button', { name: 'The New York Times' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await act(() => router.navigate('/my-feed'))

    expect(await screen.findByText('NYT result')).toBeInTheDocument()
    expect(screen.queryByText('guardian story 0')).not.toBeInTheDocument()
    expect(searches()).toEqual([
      '?source=guardian',
      '?source=guardian&cursor=page-2',
      '?source=nyt',
    ])
  })

  it('uses personalized wording when nothing matches', async () => {
    seedPreferences({ categories: ['health'] })
    server.use(feedHandler(() => feedPage()))
    renderApp('/my-feed')

    expect(
      await screen.findByText('No articles match your preferences right now.'),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: 'Edit preferences' }).length,
    ).toBeGreaterThan(0)
  })
})
