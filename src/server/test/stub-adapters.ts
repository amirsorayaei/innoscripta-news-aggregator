import { vi } from 'vitest'
import type { Article } from '../../shared/feed.js'
import type { ProviderId } from '../../shared/providers.js'
import { toArticle } from '../providers/normalize.js'
import type { ProviderAdapter, ProviderPage } from '../providers/types.js'

export function stubArticle(
  providerId: ProviderId,
  n: number,
  overrides: Partial<Article> = {},
): Article {
  return {
    ...toArticle({
      url: `https://${providerId}.example.com/story-${n}`,
      title: `${providerId} story ${n}`,
      publishedAt: new Date(
        Date.UTC(2026, 9, 19, 12) - n * 3_600_000,
      ).toISOString(),
      authors: ['Jane Doe'],
      providerId,
      publisherName: providerId,
      categoryBasis: 'article',
    })!,
    ...overrides,
  }
}

/** Adapter serving `pages` pages of ten stub articles. */
export function pagedAdapter(id: ProviderId, pages = 3) {
  const fetchPage = vi.fn<ProviderAdapter['fetchPage']>(
    async (_filters, page) => ({
      articles: Array.from({ length: 10 }, (_, i) =>
        stubArticle(id, page * 10 + i),
      ),
      rawCount: 10,
      hasMore: page < pages,
      notes: [],
    }),
  )
  return { id, maxPage: 100, fetchPage } satisfies ProviderAdapter
}

export function failingAdapter(id: ProviderId, error: Error) {
  return {
    id,
    maxPage: 100,
    fetchPage: vi.fn(async (): Promise<ProviderPage> => {
      throw error
    }),
  } satisfies ProviderAdapter
}

/** Adapter that only settles when its signal aborts. */
export function hangingAdapter(id: ProviderId) {
  const signals: AbortSignal[] = []
  const adapter = {
    id,
    maxPage: 100,
    fetchPage: vi.fn<ProviderAdapter['fetchPage']>(
      (_filters, _page, signal) =>
        new Promise<ProviderPage>((_, reject) => {
          signals.push(signal)
          signal.addEventListener('abort', () => reject(signal.reason))
        }),
    ),
  } satisfies ProviderAdapter
  return { adapter, signals }
}
