import { describe, expect, it } from 'vitest'
import { article, feedPage, status } from '@/test/articles'
import { feedEnd, summarizeFeed } from './feed-state'

const paused = status('nyt', {
  state: 'paused',
  rawCount: 0,
  matchedCount: 0,
  error: { code: 'rate_limited', message: 'Rate limited.' },
})

describe('summarizeFeed', () => {
  it('reports more results while the latest batch has a cursor', () => {
    const summary = summarizeFeed([
      feedPage({ articles: [article({ id: 'a' })], nextCursor: 'c1' }),
    ])
    expect(feedEnd(summary)).toBe('more')
  })

  it('treats an empty batch with a cursor as sparse, not finished', () => {
    const summary = summarizeFeed([
      feedPage({ articles: [article({ id: 'a' })], nextCursor: 'c1' }),
      feedPage({ articles: [], nextCursor: 'c2' }),
    ])
    expect(summary.sparse).toBe(true)
    expect(feedEnd(summary)).toBe('sparse')
  })

  it('distinguishes a finished stream from one stopped by paused providers', () => {
    expect(feedEnd(summarizeFeed([feedPage()]))).toBe('end')

    const stopped = summarizeFeed([
      feedPage({
        providerStatuses: [status('guardian', { state: 'exhausted' }), paused],
      }),
    ])
    expect(stopped.paused.map((s) => s.providerId)).toEqual(['nyt'])
    expect(feedEnd(stopped)).toBe('stopped')
  })

  it('collects notes from every batch once, ignoring not_selected', () => {
    const withNote = status('newsapi', { notes: ['publisher_categories'] })
    const summary = summarizeFeed([
      feedPage({
        providerStatuses: [
          status('guardian', { state: 'skipped', notes: ['not_selected'] }),
          withNote,
        ],
        nextCursor: 'c1',
      }),
      feedPage({ providerStatuses: [withNote] }),
    ])
    expect(summary.notes).toEqual([
      { providerId: 'newsapi', note: 'publisher_categories' },
    ])
  })
})
