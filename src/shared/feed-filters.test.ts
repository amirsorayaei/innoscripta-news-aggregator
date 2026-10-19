import { describe, expect, it } from 'vitest'
import {
  feedFiltersFromParams,
  feedFiltersToParams,
  FILTER_LIMITS,
} from './feed-filters.js'

const parse = (query: string) =>
  feedFiltersFromParams(new URLSearchParams(query))

describe('feed filters', () => {
  it('reads repeated list parameters and normalizes their order', () => {
    const result = parse(
      'q=  climate   policy &source=newsapi&source=guardian&source=newsapi' +
        '&category=sports&category=business&author=Doe%2C%20Jane&author=doe,%20jane',
    )

    expect(result.data).toEqual({
      q: 'climate policy',
      sources: ['guardian', 'newsapi'],
      categories: ['business', 'sports'],
      authors: ['Doe, Jane'],
    })
  })

  it('serializes normalized filters in a stable order', () => {
    const a = parse(
      'category=health&category=general&author=Zed%20Ray&author=Al%20Bo&from=2026-10-01',
    )
    const b = parse(
      'author=Al%20Bo&from=2026-10-01&category=general&author=Zed%20Ray&category=health',
    )

    const params = feedFiltersToParams(a.data!).toString()
    expect(params).toBe(feedFiltersToParams(b.data!).toString())
    expect(params).toBe(
      'from=2026-10-01&category=general&category=health&author=Al+Bo&author=Zed+Ray',
    )
  })

  it('round-trips through query parameters', () => {
    const filters = parse(
      'q=ai&from=2026-10-01&to=2026-10-19&source=nyt&author=A,%20B',
    ).data!
    expect(feedFiltersFromParams(feedFiltersToParams(filters)).data).toEqual(
      filters,
    )
  })

  it.each([
    ['from=2026-02-30', 'from'],
    ['to=2026-13-01', 'to'],
    ['from=19-10-2026', 'from'],
    ['from=2026-10-19&to=2026-10-18', 'from'],
    ['source=bbc', 'sources'],
    ['category=politics', 'categories'],
    [`q=${'a'.repeat(FILTER_LIMITS.queryLength + 1)}`, 'q'],
    [`author=${'a'.repeat(FILTER_LIMITS.authorLength + 1)}`, 'authors'],
  ])('rejects %s', (query, field) => {
    const result = parse(query)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(field)
  })

  it('limits the number of authors', () => {
    const query = Array.from(
      { length: FILTER_LIMITS.authors + 1 },
      (_, i) => `author=Author%20${i}`,
    ).join('&')
    expect(parse(query).success).toBe(false)
  })

  it('accepts leap days and same-day ranges', () => {
    expect(parse('from=2028-02-29&to=2028-02-29').success).toBe(true)
  })
})
