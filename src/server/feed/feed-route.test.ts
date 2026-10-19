import { request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { http, HttpResponse } from 'msw/http'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedResponse } from '../../shared/feed.js'
import { createApp } from '../app.js'
import { loadConfig } from '../config.js'
import { useMswServer } from '../test/msw.js'
import {
  guardianResponse,
  guardianResult,
  newsApiArticle,
  newsApiResponse,
  nytDoc,
  nytResponse,
} from '../test/provider-fixtures.js'
import { hangingAdapter, pagedAdapter } from '../test/stub-adapters.js'
import { createFeedService } from './feed-service.js'

const LIVE_KEYS = {
  NEWS_MODE: 'live',
  GUARDIAN_API_KEY: 'guardian-secret-key',
  NYT_API_KEY: 'nyt-secret-key',
  NEWSAPI_API_KEY: 'newsapi-secret-key',
}

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

describe('GET /api/feed in Demo mode', () => {
  const app = createApp(loadConfig({}))

  it('pages through the Demo data with cursors until it ends', async () => {
    const seen = new Set<string>()
    let cursor: string | null = null
    let batches = 0

    do {
      const response = await request(app)
        .get('/api/feed')
        .query(cursor ? { cursor } : {})
      expect(response.status).toBe(200)
      expect(response.headers['cache-control']).toBe('no-store')
      const body = response.body as FeedResponse
      expect(body.mode).toBe('demo')
      for (const a of body.articles) seen.add(`${a.providerId}:${a.id}`)
      cursor = body.nextCursor
      batches++
    } while (cursor)

    expect(batches).toBe(4)
    expect(seen.size).toBe(105)
  })

  it('accepts repeated list parameters', async () => {
    const response = await request(app).get(
      '/api/feed?source=guardian&source=nyt&category=health&category=sports',
    )
    const body = response.body as FeedResponse
    expect(response.status).toBe(200)
    expect(body.providerStatuses[2]).toMatchObject({ state: 'skipped' })
    expect(
      body.articles.every((a) => ['health', 'sports'].includes(a.category!)),
    ).toBe(true)
  })

  it('rejects invalid filters with the offending fields', async () => {
    const response = await request(app).get(
      '/api/feed?from=2026-02-30&source=bbc',
    )
    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code: 'invalid_request',
      fields: expect.arrayContaining(['from', 'sources']),
    })
  })

  it('rejects a reversed date range', async () => {
    const response = await request(app).get(
      '/api/feed?from=2026-10-19&to=2026-10-01',
    )
    expect(response.status).toBe(400)
    expect(response.body.error.fields).toEqual(['from'])
  })

  it('rejects a cursor that does not match the filters', async () => {
    const first = await request(app).get('/api/feed?q=storm')
    const response = await request(app)
      .get('/api/feed')
      .query({ q: 'rail', cursor: first.body.nextCursor ?? 'x' })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('invalid_cursor')
  })
})

describe('GET /api/feed in Live mode', () => {
  const server = useMswServer()

  it('reports incomplete configuration instead of using Demo data', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const app = createApp(
      loadConfig({ NEWS_MODE: 'live', GUARDIAN_API_KEY: 'only-one' }),
    )
    const response = await request(app).get('/api/feed')

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('configuration_error')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  function mockProviders(nytStatus = 200) {
    server.use(
      http.get('https://content.guardianapis.com/search', () =>
        HttpResponse.json(guardianResponse([guardianResult(1)])),
      ),
      http.get(
        'https://api.nytimes.com/svc/search/v2/articlesearch.json',
        () =>
          nytStatus === 200
            ? HttpResponse.json(nytResponse([nytDoc(1)]))
            : HttpResponse.json(
                { fault: { faultstring: 'detail with nyt-secret-key' } },
                { status: nytStatus },
              ),
      ),
      http.get('https://newsapi.org/v2/everything', () =>
        HttpResponse.json(newsApiResponse([newsApiArticle(1)])),
      ),
    )
  }

  it('combines all three providers', async () => {
    mockProviders()
    const response = await request(createApp(loadConfig(LIVE_KEYS))).get(
      '/api/feed',
    )
    const body = response.body as FeedResponse
    expect(response.status).toBe(200)
    expect(body.mode).toBe('live')
    expect(body.articles.map((a) => a.providerId).sort()).toEqual([
      'guardian',
      'newsapi',
      'nyt',
    ])
  })

  it('returns partial results when one provider fails, without leaking keys', async () => {
    mockProviders(500)
    const response = await request(createApp(loadConfig(LIVE_KEYS))).get(
      '/api/feed',
    )

    expect(response.status).toBe(200)
    expect(response.body.providerStatuses[1]).toMatchObject({
      providerId: 'nyt',
      state: 'paused',
      error: { code: 'upstream_unavailable' },
    })
    expect(response.text).not.toMatch(/secret-key/)
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(
      /secret-key|https?:/,
    )
  })

  it('returns 503 when every provider rejects its key', async () => {
    const denied = () =>
      HttpResponse.json({ message: 'denied' }, { status: 401 })
    server.use(
      http.get('https://content.guardianapis.com/search', denied),
      http.get(
        'https://api.nytimes.com/svc/search/v2/articlesearch.json',
        denied,
      ),
      http.get('https://newsapi.org/v2/everything', () =>
        HttpResponse.json(
          { status: 'error', code: 'apiKeyInvalid', message: 'denied' },
          { status: 401 },
        ),
      ),
    )
    const response = await request(createApp(loadConfig(LIVE_KEYS))).get(
      '/api/feed',
    )

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('all_providers_failed')
    expect(
      response.body.providerStatuses.map(
        (s: { error: { code: string } }) => s.error.code,
      ),
    ).toEqual(['unauthorized', 'unauthorized', 'unauthorized'])
    expect(response.text).not.toMatch(/secret-key|denied/)
  })
})

describe('GET /api/feed cancellation', () => {
  async function listen(app: ReturnType<typeof createApp>) {
    const server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    return { server, port: (server.address() as AddressInfo).port }
  }

  it('aborts provider work when the client disconnects', async () => {
    const { adapter, signals } = hangingAdapter('guardian')
    const feedService = createFeedService({
      mode: 'live',
      adapters: {
        guardian: adapter,
        nyt: pagedAdapter('nyt'),
        newsapi: pagedAdapter('newsapi'),
      },
      timeoutMs: 10_000,
    })
    const { server, port } = await listen(
      createApp(loadConfig({}), { feedService }),
    )

    const req = httpRequest({ port, path: '/api/feed' })
    req.on('error', () => {})
    req.end()
    await vi.waitFor(() => expect(signals).toHaveLength(1))
    req.destroy()

    await vi.waitFor(() => expect(signals[0]?.aborted).toBe(true))
    server.close()
  })

  it('does not treat a completed response as a disconnect', async () => {
    const guardian = pagedAdapter('guardian')
    const feedService = createFeedService({
      mode: 'demo',
      adapters: {
        guardian,
        nyt: pagedAdapter('nyt'),
        newsapi: pagedAdapter('newsapi'),
      },
    })
    const { server, port } = await listen(
      createApp(loadConfig({}), { feedService }),
    )

    const response = await fetch(`http://localhost:${port}/api/feed`)
    expect(response.status).toBe(200)
    await response.json()

    const signal = guardian.fetchPage.mock.calls[0]?.[2]
    expect(signal?.aborted).toBe(false)
    server.close()
  })
})
