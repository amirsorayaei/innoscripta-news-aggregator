import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { feedFiltersSchema } from '../../shared/feed-filters.js'
import { useMswServer } from '../test/msw.js'
import { guardianResponse, guardianResult } from '../test/provider-fixtures.js'
import {
  buildGuardianUrl,
  createGuardianAdapter,
  mapGuardianResponse,
} from './guardian.js'
import { ProviderError } from './types.js'

const filters = (input: object = {}) => feedFiltersSchema.parse(input)
const signal = () => new AbortController().signal

describe('buildGuardianUrl', () => {
  it('maps keyword, dates, categories and paging to native parameters', () => {
    const url = buildGuardianUrl(
      filters({
        q: 'energy',
        from: '2026-10-01',
        to: '2026-10-19',
        categories: ['health', 'business'],
      }),
      2,
      'secret',
    )
    const params = url.searchParams

    expect(url.origin + url.pathname).toBe(
      'https://content.guardianapis.com/search',
    )
    expect(params.get('q')).toBe('energy')
    expect(params.get('from-date')).toBe('2026-10-01')
    expect(params.get('to-date')).toBe('2026-10-19')
    expect(params.get('tag')).toBe('business/business|society/health')
    expect(params.get('page')).toBe('2')
    expect(params.get('page-size')).toBe('10')
    expect(params.get('order-by')).toBe('newest')
    expect(params.has('section')).toBe(false)
  })

  it('omits empty filters', () => {
    const params = buildGuardianUrl(filters(), 1, 'k').searchParams
    expect(params.has('q')).toBe(false)
    expect(params.has('tag')).toBe(false)
    expect(params.has('from-date')).toBe(false)
  })
})

describe('mapGuardianResponse', () => {
  it('maps results to articles', () => {
    const page = mapGuardianResponse(guardianResponse([guardianResult(1)]), 1)
    expect(page.rawCount).toBe(1)
    expect(page.hasMore).toBe(true)
    expect(page.articles[0]).toMatchObject({
      title: 'Synthetic business story 1',
      summary: 'Summary for story 1',
      imageUrl: 'https://media.guim.co.uk/synthetic/1/500.jpg',
      authors: ['Jane Doe'],
      providerId: 'guardian',
      publisherName: 'The Guardian',
      category: 'business',
      categoryBasis: 'article',
    })
  })

  it('prefers contributor tags and falls back to the byline', () => {
    const page = mapGuardianResponse(
      guardianResponse([guardianResult(1, { tags: [] })]),
      1,
    )
    expect(page.articles[0]?.authors).toEqual(['Jane Doe', 'John Smith'])
  })

  it('labels health from its tag and leaves unmapped sections uncategorized', () => {
    const page = mapGuardianResponse(
      guardianResponse([
        guardianResult(1, {
          sectionId: 'society',
          tags: [{ id: 'society/health', type: 'keyword', webTitle: 'Health' }],
        }),
        guardianResult(2, { sectionId: 'crosswords', tags: [] }),
      ]),
      1,
    )
    expect(page.articles.map((a) => [a.category, a.categoryBasis])).toEqual([
      ['health', 'article'],
      [undefined, 'unknown'],
    ])
  })

  it('reports the last page and drops unusable results', () => {
    const page = mapGuardianResponse(
      guardianResponse([guardianResult(1), { webTitle: 'No URL' }], 3, 3),
      3,
    )
    expect(page.hasMore).toBe(false)
    expect(page.rawCount).toBe(2)
    expect(page.articles).toHaveLength(1)
  })

  it('rejects a response without the expected structure', () => {
    expect(() => mapGuardianResponse({ results: [] }, 1)).toThrow(ProviderError)
  })
})

describe('Guardian adapter over HTTP', () => {
  const server = useMswServer()
  const endpoint = 'https://content.guardianapis.com/search'

  it('fetches a page with the API key', async () => {
    let apiKey: string | null = null
    server.use(
      http.get(endpoint, ({ request }) => {
        apiKey = new URL(request.url).searchParams.get('api-key')
        return HttpResponse.json(guardianResponse([guardianResult(1)]))
      }),
    )
    const page = await createGuardianAdapter('test-key').fetchPage(
      filters(),
      1,
      signal(),
    )
    expect(apiKey).toBe('test-key')
    expect(page.articles).toHaveLength(1)
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate_limited'],
    [502, 'upstream_unavailable'],
    [400, 'bad_request'],
  ])('maps HTTP %i to %s', async (status, code) => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status }),
      ),
    )
    await expect(
      createGuardianAdapter('k').fetchPage(filters(), 1, signal()),
    ).rejects.toMatchObject({ code })
  })

  it('maps network failures without exposing details', async () => {
    server.use(http.get(endpoint, () => HttpResponse.error()))
    const error = await createGuardianAdapter('k')
      .fetchPage(filters(), 1, signal())
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'upstream_unavailable' })
    expect(String(error)).not.toContain('api-key')
  })
})
