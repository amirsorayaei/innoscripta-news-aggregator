import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { feedFiltersSchema } from '../../shared/feed-filters.js'
import type { FeedResponse } from '../../shared/feed.js'
import { ProviderError, ProviderLimitReached } from '../providers/types.js'
import {
  failingAdapter,
  hangingAdapter,
  pagedAdapter,
  stubArticle,
} from '../test/stub-adapters.js'
import { encodeCursor, InvalidCursorError } from './cursor.js'
import { createFeedService } from './feed-service.js'
import { PageCache } from './page-cache.js'

const filters = (input: object = {}) => feedFiltersSchema.parse(input)
const signal = () => new AbortController().signal

function adapters(overrides = {}) {
  return {
    guardian: pagedAdapter('guardian'),
    nyt: pagedAdapter('nyt'),
    newsapi: pagedAdapter('newsapi'),
    ...overrides,
  }
}

function okBody(result: { status: number; body: unknown }) {
  expect(result.status).toBe(200)
  return result.body as FeedResponse
}

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

describe('feed service pagination', () => {
  it('fetches one page per provider and advances each independently', async () => {
    const all = adapters({ nyt: pagedAdapter('nyt', 1) })
    const feed = createFeedService({ mode: 'demo', adapters: all })

    const first = okBody(await feed.getFeed(filters(), undefined, signal()))
    expect(first.articles).toHaveLength(30)
    expect(first.providerStatuses.map((s) => [s.providerId, s.state])).toEqual([
      ['guardian', 'ok'],
      ['nyt', 'exhausted'],
      ['newsapi', 'ok'],
    ])

    const second = okBody(
      await feed.getFeed(filters(), first.nextCursor!, signal()),
    )
    expect(all.guardian.fetchPage).toHaveBeenLastCalledWith(
      expect.anything(),
      2,
      expect.anything(),
    )
    expect(all.nyt.fetchPage).toHaveBeenCalledTimes(1)
    expect(second.articles).toHaveLength(20)
    expect(second.providerStatuses[1]).toMatchObject({
      state: 'exhausted',
      rawCount: 0,
    })
  })

  it('ends with a null cursor once every provider is exhausted', async () => {
    const feed = createFeedService({
      mode: 'demo',
      adapters: adapters({
        guardian: pagedAdapter('guardian', 1),
        nyt: pagedAdapter('nyt', 1),
        newsapi: pagedAdapter('newsapi', 1),
      }),
    })
    const body = okBody(await feed.getFeed(filters(), undefined, signal()))
    expect(body.nextCursor).toBeNull()
  })

  it('sorts articles newest first', async () => {
    const feed = createFeedService({ mode: 'demo', adapters: adapters() })
    const body = okBody(await feed.getFeed(filters(), undefined, signal()))
    const times = body.articles.map((a) => a.publishedAt)
    expect(times).toEqual([...times].sort().reverse())
  })

  it('skips providers excluded by the source filter', async () => {
    const all = adapters()
    const feed = createFeedService({ mode: 'demo', adapters: all })
    const body = okBody(
      await feed.getFeed(
        filters({ sources: ['guardian'] }),
        undefined,
        signal(),
      ),
    )
    expect(all.nyt.fetchPage).not.toHaveBeenCalled()
    expect(body.providerStatuses[1]).toMatchObject({
      state: 'skipped',
      notes: ['not_selected'],
    })
  })

  it('skips providers that cannot serve the date range', async () => {
    const newsapi = {
      ...pagedAdapter('newsapi'),
      unavailableFor: () => 'date_out_of_range' as const,
    }
    const feed = createFeedService({
      mode: 'demo',
      adapters: adapters({ newsapi }),
    })
    const body = okBody(await feed.getFeed(filters(), undefined, signal()))
    expect(newsapi.fetchPage).not.toHaveBeenCalled()
    expect(body.providerStatuses[2]).toMatchObject({
      state: 'skipped',
      notes: ['date_out_of_range'],
    })
  })

  it('treats a provider result limit as exhausted with a note, not an error', async () => {
    const feed = createFeedService({
      mode: 'demo',
      adapters: adapters({
        newsapi: failingAdapter(
          'newsapi',
          new ProviderLimitReached('result_limit_reached'),
        ),
      }),
    })
    const body = okBody(await feed.getFeed(filters(), undefined, signal()))
    expect(body.providerStatuses[2]).toMatchObject({
      state: 'exhausted',
      notes: ['result_limit_reached'],
    })
    expect(body.providerStatuses[2]?.error).toBeUndefined()
  })
})

describe('feed service post-filters', () => {
  it('keeps only articles by the requested authors and reports counts', async () => {
    const guardian = pagedAdapter('guardian')
    guardian.fetchPage.mockResolvedValueOnce({
      articles: [
        stubArticle('guardian', 1, { authors: ['Zoë Ångström'] }),
        stubArticle('guardian', 2, { authors: ['Someone Else'] }),
      ],
      rawCount: 3,
      hasMore: true,
      notes: [],
    })
    const feed = createFeedService({
      mode: 'demo',
      adapters: adapters({ guardian }),
    })
    const body = okBody(
      await feed.getFeed(
        filters({ sources: ['guardian'], authors: ['zoë  ångström'] }),
        undefined,
        signal(),
      ),
    )
    expect(body.articles.map((a) => a.authors)).toEqual([['Zoë Ångström']])
    expect(body.providerStatuses[0]).toMatchObject({
      state: 'ok',
      rawCount: 3,
      matchedCount: 1,
    })
    expect(body.nextCursor).not.toBeNull()
  })

  it('enforces UTC day boundaries on every provider', async () => {
    const guardian = pagedAdapter('guardian')
    guardian.fetchPage.mockResolvedValueOnce({
      articles: [
        stubArticle('guardian', 1, { publishedAt: '2026-10-18T23:59:59.000Z' }),
        stubArticle('guardian', 2, { publishedAt: '2026-10-19T00:00:00.000Z' }),
        stubArticle('guardian', 3, { publishedAt: '2026-10-19T23:59:59.999Z' }),
        stubArticle('guardian', 4, { publishedAt: '2026-10-20T00:00:00.000Z' }),
      ],
      rawCount: 4,
      hasMore: false,
      notes: [],
    })
    const feed = createFeedService({
      mode: 'demo',
      adapters: adapters({ guardian }),
    })
    const body = okBody(
      await feed.getFeed(
        filters({
          sources: ['guardian'],
          from: '2026-10-19',
          to: '2026-10-19',
        }),
        undefined,
        signal(),
      ),
    )
    expect(body.articles.map((a) => a.publishedAt)).toEqual([
      '2026-10-19T23:59:59.999Z',
      '2026-10-19T00:00:00.000Z',
    ])
  })
})

describe('feed service failures', () => {
  it('returns partial results and pauses the failed provider', async () => {
    const nyt = failingAdapter('nyt', new ProviderError('rate_limited'))
    const feed = createFeedService({
      mode: 'live',
      adapters: adapters({ nyt }),
    })

    const first = okBody(await feed.getFeed(filters(), undefined, signal()))
    expect(first.articles).toHaveLength(20)
    expect(first.providerStatuses[1]).toMatchObject({
      state: 'paused',
      error: { code: 'rate_limited' },
    })

    const second = okBody(
      await feed.getFeed(filters(), first.nextCursor!, signal()),
    )
    expect(nyt.fetchPage).toHaveBeenCalledTimes(1)
    expect(second.providerStatuses[1]).toMatchObject({ state: 'paused' })
  })

  it('returns 503 with safe statuses when every attempted provider fails', async () => {
    const error = new ProviderError('unauthorized')
    const feed = createFeedService({
      mode: 'live',
      adapters: {
        guardian: failingAdapter('guardian', error),
        nyt: failingAdapter(
          'nyt',
          new Error('https://api.example?api-key=leak'),
        ),
        newsapi: failingAdapter('newsapi', error),
      },
    })
    const result = await feed.getFeed(filters(), undefined, signal())

    expect(result.status).toBe(503)
    expect(result.body).toMatchObject({
      error: { code: 'all_providers_failed' },
    })
    expect(JSON.stringify(result.body)).not.toContain('leak')
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      'leak',
    )
  })

  it('times out a slow provider without failing the others', async () => {
    const { adapter, signals } = hangingAdapter('nyt')
    const feed = createFeedService({
      mode: 'live',
      adapters: adapters({ nyt: adapter }),
      timeoutMs: 20,
    })
    const body = okBody(await feed.getFeed(filters(), undefined, signal()))

    expect(body.providerStatuses[1]).toMatchObject({
      state: 'paused',
      error: { code: 'timeout' },
    })
    expect(signals[0]?.aborted).toBe(true)
  })

  it('aborts provider requests when the client disconnects', async () => {
    const { adapter, signals } = hangingAdapter('guardian')
    const controller = new AbortController()
    const feed = createFeedService({
      mode: 'live',
      adapters: adapters({ guardian: adapter }),
      timeoutMs: 10_000,
    })

    const pending = feed.getFeed(filters(), undefined, controller.signal)
    controller.abort()

    await expect(pending).rejects.toBeDefined()
    expect(signals[0]?.aborted).toBe(true)
  })
})

describe('feed service cache', () => {
  it('reuses successful pages and ignores the author filter in the key', async () => {
    const all = adapters()
    const feed = createFeedService({
      mode: 'demo',
      adapters: all,
      cache: new PageCache(),
    })

    await feed.getFeed(filters(), undefined, signal())
    await feed.getFeed(filters({ authors: ['Jane Doe'] }), undefined, signal())
    expect(all.guardian.fetchPage).toHaveBeenCalledTimes(1)

    await feed.getFeed(filters({ q: 'other' }), undefined, signal())
    expect(all.guardian.fetchPage).toHaveBeenCalledTimes(2)
  })

  it('does not cache failures', async () => {
    const nyt = failingAdapter('nyt', new ProviderError('upstream_unavailable'))
    const feed = createFeedService({
      mode: 'live',
      adapters: adapters({ nyt }),
    })

    await feed.getFeed(filters(), undefined, signal())
    await feed.getFeed(filters(), undefined, signal())
    expect(nyt.fetchPage).toHaveBeenCalledTimes(2)
  })
})

describe('feed service cursors', () => {
  it('rejects a cursor issued for different filters or mode', async () => {
    const feed = createFeedService({ mode: 'demo', adapters: adapters() })
    const { nextCursor } = okBody(
      await feed.getFeed(filters({ q: 'a' }), undefined, signal()),
    )
    await expect(
      feed.getFeed(filters({ q: 'b' }), nextCursor!, signal()),
    ).rejects.toBeInstanceOf(InvalidCursorError)

    const live = createFeedService({ mode: 'live', adapters: adapters() })
    await expect(
      live.getFeed(filters({ q: 'a' }), nextCursor!, signal()),
    ).rejects.toBeInstanceOf(InvalidCursorError)
  })

  it.each([
    ['garbage', 'not-a-cursor'],
    ['oversized', 'a'.repeat(2000)],
    [
      'unknown provider',
      encodeCursor('x', { bbc: { s: 'next', page: 2 } } as never),
    ],
    [
      'page out of bounds',
      encodeCursor('x', {
        guardian: { s: 'next', page: 500 },
        nyt: { s: 'exhausted' },
        newsapi: { s: 'exhausted' },
      }),
    ],
  ])('rejects a %s cursor', async (_label, cursor) => {
    const feed = createFeedService({ mode: 'demo', adapters: adapters() })
    await expect(
      feed.getFeed(filters(), cursor, signal()),
    ).rejects.toBeInstanceOf(InvalidCursorError)
  })
})
