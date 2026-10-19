import { describe, expect, it } from 'vitest'
import { PageCache } from './page-cache.js'

const page = (rawCount: number) => ({
  articles: [],
  rawCount,
  hasMore: false,
  notes: [],
})

describe('PageCache', () => {
  it('expires entries after the TTL', () => {
    let now = 0
    const cache = new PageCache(10, 1000, () => now)
    cache.set('a', page(1))

    now = 999
    expect(cache.get('a')?.rawCount).toBe(1)
    now = 1000
    expect(cache.get('a')).toBeUndefined()
  })

  it('evicts the oldest entry beyond the size limit', () => {
    const cache = new PageCache(2)
    cache.set('a', page(1))
    cache.set('b', page(2))
    cache.set('c', page(3))

    expect(cache.size).toBe(2)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('c')?.rawCount).toBe(3)
  })
})
