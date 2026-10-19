import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { categoryIds } from '../../shared/categories.js'
import { feedFiltersSchema } from '../../shared/feed-filters.js'
import { useMswServer } from '../test/msw.js'
import { newsApiArticle, newsApiResponse } from '../test/provider-fixtures.js'
import {
  buildNewsApiRequest,
  createNewsApiAdapter,
  mapNewsApiResponse,
  newsApiCategorySources,
} from './newsapi.js'
import { ProviderLimitReached } from './types.js'

const filters = (input: object = {}) => feedFiltersSchema.parse(input)
const NOW = Date.parse('2026-10-19T12:00:00Z')

describe('NewsAPI publisher categories', () => {
  it('exclude IDs missing from the live English catalogue', () => {
    const all = Object.values(newsApiCategorySources).flat()
    expect(all).not.toContain('reuters')
    expect(all).not.toContain('entertainment-weekly')
  })

  it('stay within the 20-source limit with at least one source per category', () => {
    const all = Object.values(newsApiCategorySources).flat()
    expect(all.length).toBeLessThanOrEqual(20)
    expect(new Set(all).size).toBe(all.length)
    for (const category of categoryIds) {
      expect(newsApiCategorySources[category].length).toBeGreaterThan(0)
    }
  })
})

describe('buildNewsApiRequest', () => {
  it('uses curated sources for categories and notes the publisher basis', () => {
    const { url, notes } = buildNewsApiRequest(
      filters({ q: 'robots', categories: ['technology', 'health'] }),
      2,
      NOW,
    )
    const params = url.searchParams
    expect(params.get('q')).toBe('robots')
    expect(params.get('sources')).toBe(
      'techcrunch,the-verge,wired,medical-news-today',
    )
    expect(params.get('language')).toBe('en')
    expect(params.get('sortBy')).toBe('publishedAt')
    expect(params.get('pageSize')).toBe('10')
    expect(params.get('page')).toBe('2')
    expect(notes).toEqual(['publisher_categories'])
  })

  it('searches all curated sources without q when there is no keyword', () => {
    const { url, notes } = buildNewsApiRequest(filters(), 1, NOW)
    expect(url.searchParams.has('q')).toBe(false)
    expect(url.searchParams.get('sources')?.split(',')).toHaveLength(
      Object.values(newsApiCategorySources).flat().length,
    )
    expect(notes).toEqual([])
  })

  it('clamps a start date older than the plan allows', () => {
    const { url, notes } = buildNewsApiRequest(
      filters({ from: '2026-08-01', to: '2026-10-10' }),
      1,
      NOW,
    )
    expect(url.searchParams.get('from')).toBe('2026-09-19')
    expect(url.searchParams.get('to')).toBe('2026-10-10T23:59:59')
    expect(notes).toEqual(['date_range_clamped'])
  })

  it('never puts the API key in the URL', () => {
    const { url } = buildNewsApiRequest(filters(), 1, NOW)
    expect(url.toString()).not.toMatch(/apikey/i)
  })
})

describe('NewsAPI availability', () => {
  it('skips ranges that end before the searchable window', () => {
    const adapter = createNewsApiAdapter('k', () => NOW)
    expect(adapter.unavailableFor?.(filters({ to: '2026-09-18' }))).toBe(
      'date_out_of_range',
    )
    expect(
      adapter.unavailableFor?.(filters({ to: '2026-09-19' })),
    ).toBeUndefined()
  })
})

describe('mapNewsApiResponse', () => {
  it('maps articles with publisher-based categories', () => {
    const page = mapNewsApiResponse(newsApiResponse([newsApiArticle(1)]), 1, [])
    expect(page.articles[0]).toMatchObject({
      canonicalUrl: 'https://techcrunch.com/2026/10/19/synthetic-1/',
      summary: 'Description for synthetic story 1.',
      authors: ['Jane Doe', 'John Smith'],
      publisherName: 'TechCrunch',
      category: 'technology',
      categoryBasis: 'publisher',
    })
  })

  it('leaves unknown publishers uncategorized and drops removed articles', () => {
    const page = mapNewsApiResponse(
      newsApiResponse([
        newsApiArticle(1, { source: { id: null, name: 'Some Blog' } }),
        newsApiArticle(2, { title: '[Removed]', url: 'https://removed.com' }),
      ]),
      1,
      [],
    )
    expect(page.rawCount).toBe(2)
    expect(page.articles).toHaveLength(1)
    expect(page.articles[0]).toMatchObject({ categoryBasis: 'unknown' })
    expect(page.articles[0]?.category).toBeUndefined()
  })

  it('computes more pages from totalResults', () => {
    expect(mapNewsApiResponse(newsApiResponse([], 25), 2, []).hasMore).toBe(
      true,
    )
    expect(mapNewsApiResponse(newsApiResponse([], 25), 3, []).hasMore).toBe(
      false,
    )
  })
})

describe('NewsAPI adapter over HTTP', () => {
  const server = useMswServer()
  const endpoint = 'https://newsapi.org/v2/everything'
  const fetchPage = () =>
    createNewsApiAdapter('header-key', () => NOW).fetchPage(
      filters(),
      11,
      new AbortController().signal,
    )

  it('sends the key in the X-Api-Key header', async () => {
    let header: string | null = null
    let url = ''
    server.use(
      http.get(endpoint, ({ request }) => {
        header = request.headers.get('x-api-key')
        url = request.url
        return HttpResponse.json(newsApiResponse([newsApiArticle(1)]))
      }),
    )
    await fetchPage()
    expect(header).toBe('header-key')
    expect(url).not.toContain('header-key')
  })

  it.each([
    [401, 'apiKeyInvalid', 'unauthorized'],
    [429, 'rateLimited', 'rate_limited'],
    [429, 'apiKeyExhausted', 'rate_limited'],
    [400, 'parameterInvalid', 'bad_request'],
    [500, 'unexpectedError', 'upstream_unavailable'],
  ])('maps %i %s to %s', async (status, apiCode, code) => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json(
          { status: 'error', code: apiCode, message: 'Upstream detail' },
          { status },
        ),
      ),
    )
    const error = await fetchPage().catch((e: unknown) => e)
    expect(error).toMatchObject({ code })
    expect(String(error)).not.toContain('Upstream detail')
  })

  it('reports the plan result limit separately from errors', async () => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json(
          { status: 'error', code: 'maximumResultsReached', message: 'Limit' },
          { status: 426 },
        ),
      ),
    )
    const error = await fetchPage().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ProviderLimitReached)
    expect(error).toMatchObject({ note: 'result_limit_reached' })
  })
})
