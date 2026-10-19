import { describe, expect, it } from 'vitest'
import { exploreFiltersFromParams, exploreSearch } from './explore-url'

const read = (search: string) =>
  exploreFiltersFromParams(new URLSearchParams(search))

describe('Explore URL state', () => {
  it('round-trips normalized filters through one canonical form', () => {
    const filters = read(
      'category=sports&q=%20%20rail%20%20strike&source=newsapi&source=guardian&from=2026-10-01&category=health',
    )
    const search = exploreSearch(filters)

    expect(search).toBe(
      'q=rail+strike&from=2026-10-01&source=guardian&source=newsapi&category=health&category=sports',
    )
    expect(exploreSearch(read(search))).toBe(search)
  })

  it('drops invalid values but keeps unrelated valid filters', () => {
    const filters = read(
      'source=bbc&source=nyt&category=politics&category=science&from=2026-02-30&to=2026-10-19&q=ai',
    )
    expect(filters).toEqual({
      q: 'ai',
      to: '2026-10-19',
      sources: ['nyt'],
      categories: ['science'],
      authors: [],
    })
  })

  it('drops a reversed date range as a whole', () => {
    const filters = read('from=2026-10-19&to=2026-10-01&source=guardian')
    expect(filters.from).toBeUndefined()
    expect(filters.to).toBeUndefined()
    expect(filters.sources).toEqual(['guardian'])
  })

  it('truncates long keywords and ignores authors and unknown parameters', () => {
    const filters = read(`q=${'a'.repeat(150)}&author=Jane%20Doe&page=3`)
    expect(filters.q).toHaveLength(100)
    expect(exploreSearch(filters)).toBe(`q=${'a'.repeat(100)}`)
  })
})
