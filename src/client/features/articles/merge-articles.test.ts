import { describe, expect, it } from 'vitest'
import { article } from '@/test/articles'
import { mergeArticles } from './merge-articles'

describe('mergeArticles', () => {
  it('keeps one card per canonical URL, preferring Guardian, then NYT, then NewsAPI', () => {
    const merged = mergeArticles([
      [
        article({
          id: 'a',
          providerId: 'newsapi',
          publisherName: 'Wire',
          title: 'From NewsAPI',
        }),
        article({
          id: 'a',
          providerId: 'nyt',
          publisherName: 'The New York Times',
          title: 'From NYT',
        }),
      ],
      [article({ id: 'a', providerId: 'guardian', title: 'From Guardian' })],
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      title: 'From Guardian',
      providerId: 'guardian',
      providers: ['guardian', 'nyt', 'newsapi'],
    })
  })

  it('fills missing optional metadata from other copies without inventing it', () => {
    const [merged] = mergeArticles([
      [
        article({ id: 'a', providerId: 'guardian' }),
        article({
          id: 'a',
          providerId: 'newsapi',
          summary: 'Wire summary',
          imageUrl: 'https://img.test/a.jpg',
          authors: ['Jane Doe'],
          category: 'business',
          categoryBasis: 'publisher',
        }),
      ],
    ])

    expect(merged).toMatchObject({
      summary: 'Wire summary',
      imageUrl: 'https://img.test/a.jpg',
      authors: ['Jane Doe'],
      category: 'business',
      categoryBasis: 'publisher',
    })
  })

  it('keeps unknown categories unknown', () => {
    const [merged] = mergeArticles([[article({ id: 'a' })]])
    expect(merged?.category).toBeUndefined()
    expect(merged?.categoryBasis).toBe('unknown')
  })

  it('collapses repeats from the same provider across pages', () => {
    const merged = mergeArticles([
      [article({ id: 'a' })],
      [article({ id: 'a' })],
    ])
    expect(merged.map((a) => a.providers)).toEqual([['guardian']])
  })

  it('sorts newest first, then by ID, regardless of batch order', () => {
    const merged = mergeArticles([
      [article({ id: 'b', publishedAt: '2026-10-19T08:00:00.000Z' })],
      [
        article({ id: 'c', publishedAt: '2026-10-19T09:00:00.000Z' }),
        article({ id: 'a', publishedAt: '2026-10-19T08:00:00.000Z' }),
      ],
    ])
    expect(merged.map((a) => a.id)).toEqual(['c', 'a', 'b'])
  })
})
