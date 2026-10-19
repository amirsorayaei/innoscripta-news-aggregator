import { afterEach, describe, expect, it, vi } from 'vitest'
import { categoryIds } from '../../shared/categories.js'
import { feedFiltersSchema } from '../../shared/feed-filters.js'
import { providerIds } from '../../shared/providers.js'
import { createDemoAdapters } from './demo-adapter.js'
import { buildDemoArticles, DEFAULT_DEMO_NOW } from './demo-articles.js'

const filters = (input: object = {}) => feedFiltersSchema.parse(input)
const signal = new AbortController().signal

describe('Demo articles', () => {
  const articles = buildDemoArticles(DEFAULT_DEMO_NOW)

  it('are deterministic for a given DEMO_NOW', () => {
    expect(buildDemoArticles(DEFAULT_DEMO_NOW)).toEqual(articles)
    const later = buildDemoArticles(DEFAULT_DEMO_NOW + 3_600_000)
    expect(later.guardian[0]?.publishedAt).toBe('2026-10-19T10:00:00.000Z')
  })

  it('give every provider at least three pages and all categories', () => {
    for (const id of providerIds) {
      expect(articles[id].length).toBeGreaterThan(30)
      expect(new Set(articles[id].map((a) => a.category))).toEqual(
        new Set(categoryIds),
      )
    }
  })

  it('include multi-author bylines and canonical duplicates across providers', () => {
    const all = providerIds.flatMap((id) => articles[id])
    expect(all.some((a) => a.authors.length > 1)).toBe(true)

    const guardianIds = new Set(articles.guardian.map((a) => a.id))
    const duplicates = articles.newsapi.filter((a) => guardianIds.has(a.id))
    expect(duplicates.length).toBeGreaterThan(0)
    expect(duplicates[0]?.url).toContain('utm_source=newsapi')
  })

  it('label NewsAPI categories as publisher-based', () => {
    expect(articles.newsapi.every((a) => a.categoryBasis === 'publisher')).toBe(
      true,
    )
    expect(articles.guardian.every((a) => a.categoryBasis === 'article')).toBe(
      true,
    )
  })
})

describe('Demo adapters', () => {
  afterEach(() => vi.restoreAllMocks())

  it('page through results ten at a time without network access', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { guardian } = createDemoAdapters(DEFAULT_DEMO_NOW)

    const pages = [1, 2, 3, 4].map((page) =>
      guardian.fetchPage(filters(), page, signal),
    )
    const [first, , , last] = await Promise.all(pages)

    expect(first?.articles).toHaveLength(10)
    expect(first?.hasMore).toBe(true)
    expect(last?.articles).toHaveLength(5)
    expect(last?.hasMore).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('apply keyword, category and date filters', async () => {
    const { nyt, newsapi } = createDemoAdapters(DEFAULT_DEMO_NOW)

    const keyword = await nyt.fetchPage(
      filters({ q: 'Satellite internet' }),
      1,
      signal,
    )
    expect(keyword.articles.map((a) => a.title)).toEqual([
      'Satellite internet trial connects mountain clinics',
    ])

    const category = await newsapi.fetchPage(
      filters({ categories: ['sports'] }),
      1,
      signal,
    )
    expect(category.articles.every((a) => a.category === 'sports')).toBe(true)
    expect(category.notes).toEqual(['publisher_categories'])

    const dated = await nyt.fetchPage(
      filters({ from: '2026-10-19', to: '2026-10-19' }),
      1,
      signal,
    )
    expect(
      dated.articles.every((a) => a.publishedAt.startsWith('2026-10-19')),
    ).toBe(true)
    expect(dated.articles.length).toBeGreaterThan(0)
  })
})
