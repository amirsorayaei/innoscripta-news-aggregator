import { describe, expect, it, vi } from 'vitest'
import type { FeedFilters } from '../src/shared/feed-filters.js'
import { mapGuardianResponse } from '../src/server/providers/guardian.js'
import { mapNytResponse } from '../src/server/providers/nyt.js'
import {
  guardianResponse,
  guardianResult,
  nytDoc,
  nytResponse,
} from '../src/server/test/provider-fixtures.js'
import {
  evaluateSourceCatalogue,
  runProviderChecks,
  tally,
  type CheckOutcome,
  type PageLoader,
} from './smoke-checks.js'

type Responder = (filters: FeedFilters, page: number) => unknown

/** Synthetic Guardian HTTP 200 responses mapped through the real mapper. */
function guardianLoader(respond: Responder) {
  return vi.fn<PageLoader>(async (filters, page) => {
    const body = respond(filters, page)
    return { status: 200, body, map: () => mapGuardianResponse(body, page) }
  })
}

const results = (from: number, count: number, overrides: object = {}) =>
  Array.from({ length: count }, (_, i) => guardianResult(from + i, overrides))

const run = (load: PageLoader, categories = false) => {
  const pause = vi.fn(async () => {})
  const outcomes = runProviderChecks(load, {
    categories,
    now: Date.parse('2026-10-19T12:00:00Z'),
    pause,
  })
  return { outcomes, pause }
}

const verdictOf = (outcomes: CheckOutcome[], name: string) =>
  outcomes.find((o) => o.name === name)?.verdict

describe('Live smoke verdicts', () => {
  it('fails a 200 page whose only article has an invalid date (regression)', async () => {
    const load = guardianLoader(() =>
      guardianResponse(
        [guardianResult(1, { webPublicationDate: 'not-a-date' })],
        1,
        1,
      ),
    )
    const outcomes = await run(load).outcomes

    expect(outcomes[0]).toMatchObject({ name: 'page 1', verdict: 'fail' })
    expect(outcomes[0]?.detail).toContain('none usable')
    const summary = tally(outcomes)
    expect(summary.exitCode).toBe(1)
    expect(summary.message).not.toContain('All')
  })

  it('passes when page 2 advances, allowing partial overlap from offset drift', async () => {
    const load = guardianLoader((filters, page) =>
      filters.q
        ? guardianResponse(results(100, 3), 1, 1)
        : guardianResponse(results(page === 1 ? 0 : 8, 10), page, 5),
    )
    const outcomes = await run(load).outcomes

    expect(verdictOf(outcomes, 'page 1')).toBe('pass')
    const page2 = outcomes.find((o) => o.name === 'page 2')
    expect(page2?.verdict).toBe('pass')
    expect(page2?.detail).toContain('2 article(s) overlapped page 1')
    expect(tally(outcomes).exitCode).toBe(0)
  })

  it('fails when page 2 repeats every page 1 article', async () => {
    const load = guardianLoader((_filters, page) =>
      guardianResponse(results(0, 10), page, 5),
    )
    expect(verdictOf(await run(load).outcomes, 'page 2')).toBe('fail')
  })

  it('fails when page 1 promised more but page 2 is empty', async () => {
    const load = guardianLoader((_filters, page) =>
      guardianResponse(page === 1 ? results(0, 10) : [], page, 5),
    )
    const outcomes = await run(load).outcomes
    const page2 = outcomes.find((o) => o.name === 'page 2')
    expect(page2?.verdict).toBe('fail')
    expect(page2?.detail).toContain('page 2 was empty')
  })

  it('does not request page 2 when page 1 has no more pages', async () => {
    const load = guardianLoader(() => guardianResponse(results(0, 4), 1, 1))
    const { outcomes, pause } = run(load)
    const result = await outcomes

    expect(verdictOf(result, 'page 2')).toBe('inconclusive')
    expect(load.mock.calls.map(([, page]) => page)).toEqual([1, 1])
    expect(pause).toHaveBeenCalledTimes(1)
    expect(tally(result).exitCode).toBe(2)
  })

  it('fails on HTTP errors and invalid structures', async () => {
    const load = vi.fn<PageLoader>(async (_filters, page) => ({
      status: page === 1 ? 429 : 200,
      body: {},
      map: () => mapGuardianResponse({}, page),
    }))
    const outcomes = await run(load).outcomes
    expect(outcomes[0]).toMatchObject({
      verdict: 'fail',
      detail: 'HTTP 429 → rate_limited',
    })
    expect(verdictOf(outcomes, 'keyword "climate" + last 3 days')).toBe('fail')
  })

  it('reports an empty keyword search as inconclusive, not passed', async () => {
    const load = guardianLoader((filters, page) =>
      guardianResponse(filters.q ? [] : results(page * 10, 10), page, 5),
    )
    const outcomes = await run(load).outcomes
    expect(verdictOf(outcomes, 'keyword "climate" + last 3 days')).toBe(
      'inconclusive',
    )
  })
})

describe('Live smoke category verdicts', () => {
  const healthTag = [
    { id: 'society/health', type: 'keyword', webTitle: 'Health' },
  ]

  function categoryLoader(
    respond: (categories: FeedFilters['categories']) => unknown[],
  ) {
    return guardianLoader((filters, page) =>
      filters.categories.length
        ? guardianResponse(respond(filters.categories), 1, 1)
        : guardianResponse(results(page * 10, 10), page, filters.q ? 1 : 5),
    )
  }

  it('never certifies a mapping from an empty page', async () => {
    const outcomes = await run(
      categoryLoader(() => []),
      true,
    ).outcomes
    const categoryOutcomes = outcomes.filter((o) =>
      o.name.startsWith('category'),
    )

    expect(categoryOutcomes).toHaveLength(8)
    expect(categoryOutcomes.every((o) => o.verdict === 'inconclusive')).toBe(
      true,
    )
  })

  it('passes a category only when results map back to it', async () => {
    const outcomes = await run(
      categoryLoader((categories) =>
        categories.includes('business')
          ? results(0, 3)
          : results(0, 3, { sectionId: 'crosswords' }),
      ),
      true,
    ).outcomes

    expect(verdictOf(outcomes, 'category business')).toBe('pass')
    expect(verdictOf(outcomes, 'category science')).toBe('inconclusive')
  })

  it('requires both categories for the mixed business + health check', async () => {
    const onlyBusiness = await run(
      categoryLoader(() => results(0, 3)),
      true,
    ).outcomes
    expect(verdictOf(onlyBusiness, 'category business + health')).toBe(
      'inconclusive',
    )

    const both = await run(
      categoryLoader(() => [
        ...results(0, 2),
        guardianResult(9, { sectionId: 'society', tags: healthTag }),
      ]),
      true,
    ).outcomes
    expect(verdictOf(both, 'category business + health')).toBe('pass')
  })

  it('stays within the request budget', async () => {
    const load = categoryLoader(() => results(0, 3))
    const { outcomes, pause } = run(load, true)
    await outcomes
    // page 1, page 2, keyword, 7 categories and the mixed check.
    expect(load).toHaveBeenCalledTimes(11)
    expect(pause).toHaveBeenCalledTimes(10)
  })
})

describe('Live smoke with other providers', () => {
  it('fails an NYT page whose documents are all unusable', async () => {
    const load = vi.fn<PageLoader>(async (_filters, page) => {
      const body = nytResponse([nytDoc(1, { pub_date: 'soon' })], 0, 1)
      return { status: 200, body, map: () => mapNytResponse(body, page) }
    })
    expect(verdictOf(await run(load).outcomes, 'page 1')).toBe('fail')
  })

  it('fails the NewsAPI catalogue check when a curated source is missing', () => {
    const curated = {
      general: ['bbc-news'],
      business: ['ghost-source'],
    } as never
    const catalogue = new Map([['bbc-news', 'general']])
    expect(evaluateSourceCatalogue(200, catalogue, curated).verdict).toBe(
      'fail',
    )
    expect(evaluateSourceCatalogue(401, new Map(), curated).verdict).toBe(
      'fail',
    )
  })
})
