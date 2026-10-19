import { http, HttpResponse } from 'msw/http'
import { describe, expect, it } from 'vitest'
import { feedFiltersSchema } from '../../shared/feed-filters.js'
import { useMswServer } from '../test/msw.js'
import { nytDoc, nytLegacyDoc, nytResponse } from '../test/provider-fixtures.js'
import { buildNytUrl, createNytAdapter, mapNytResponse } from './nyt.js'
import { ProviderError } from './types.js'

const filters = (input: object = {}) => feedFiltersSchema.parse(input)

describe('buildNytUrl', () => {
  it('maps filters to Article Search parameters with zero-based pages', () => {
    const params = buildNytUrl(
      filters({
        q: 'chips',
        from: '2026-10-01',
        to: '2026-10-19',
        categories: ['technology', 'health'],
      }),
      1,
      'secret',
    ).searchParams

    expect(params.get('q')).toBe('chips')
    expect(params.get('begin_date')).toBe('20261001')
    expect(params.get('end_date')).toBe('20261019')
    expect(params.get('fq')).toBe('section.name:("Technology" "Health" "Well")')
    expect(params.get('sort')).toBe('newest')
    expect(params.get('page')).toBe('0')
  })
})

describe('mapNytResponse', () => {
  it('maps the current document shape', () => {
    const page = mapNytResponse(nytResponse([nytDoc(1)]), 1)
    expect(page.articles[0]).toMatchObject({
      title: 'Synthetic technology story 1',
      summary: 'Abstract for synthetic story 1.',
      imageUrl: 'https://static01.nyt.com/images/2026/10/19/synthetic-1.jpg',
      authors: ['Jane Doe', 'John Smith'],
      publishedAt: '2026-10-19T08:00:05.000Z',
      providerId: 'nyt',
      category: 'technology',
      categoryBasis: 'article',
    })
  })

  it('maps the legacy shape with structured bylines and relative images', () => {
    const page = mapNytResponse(nytResponse([nytLegacyDoc(1)]), 1)
    expect(page.articles[0]).toMatchObject({
      authors: ['Jane Q. Doe'],
      imageUrl: 'https://static01.nyt.com/images/2026/10/19/legacy-1.jpg',
      publishedAt: '2026-10-19T08:00:05.000Z',
    })
  })

  it.each([
    ['object', { default: { url: 'http://[' } }],
    ['legacy array', [{ url: 'http://[', subtype: 'xlarge' }]],
  ])(
    'treats a malformed %s image URL as missing and keeps neighbours',
    (_shape, multimedia) => {
      const page = mapNytResponse(
        nytResponse([nytDoc(1, { multimedia }), nytDoc(2)]),
        1,
      )

      expect(page.articles).toHaveLength(2)
      expect(page.articles[0]?.title).toBe('Synthetic technology story 1')
      expect(page.articles[0]?.imageUrl).toBeUndefined()
      expect(page.articles[1]?.imageUrl).toBe(
        'https://static01.nyt.com/images/2026/10/19/synthetic-2.jpg',
      )
    },
  )

  it('still drops documents missing required fields', () => {
    const page = mapNytResponse(
      nytResponse([nytDoc(1, { web_url: 'not a url' }), nytDoc(2)]),
      1,
    )
    expect(page.articles.map((a) => a.title)).toEqual([
      'Synthetic technology story 2',
    ])
  })

  it('uses hits and offset to detect more pages', () => {
    const docs = Array.from({ length: 10 }, (_, i) => nytDoc(i))
    expect(mapNytResponse(nytResponse(docs, 10, 25), 2).hasMore).toBe(true)
    expect(
      mapNytResponse(nytResponse(docs.slice(0, 5), 20, 25), 3).hasMore,
    ).toBe(false)
  })

  it('rejects malformed responses', () => {
    expect(() => mapNytResponse({ status: 'OK' }, 1)).toThrow(ProviderError)
  })
})

describe('NYT adapter over HTTP', () => {
  const server = useMswServer()
  const endpoint = 'https://api.nytimes.com/svc/search/v2/articlesearch.json'

  it.each([
    [401, 'unauthorized'],
    [429, 'rate_limited'],
  ])('maps HTTP %i to %s', async (status, code) => {
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json(
          { fault: { faultstring: 'Invalid ApiKey' } },
          { status },
        ),
      ),
    )
    await expect(
      createNytAdapter('k').fetchPage(
        filters(),
        1,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code })
  })

  it('rejects an HTML error page as an upstream error, not a crash', async () => {
    server.use(
      http.get(
        endpoint,
        () => new HttpResponse('<html>Forbidden</html>', { status: 403 }),
      ),
    )
    await expect(
      createNytAdapter('k').fetchPage(
        filters(),
        1,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })
})
