import type { Article, FeedResponse, ProviderStatus } from '@shared/feed'
import type { ProviderId } from '@shared/providers'

/** Synthetic article; `id` doubles as the canonical URL identity. */
export function article(overrides: Partial<Article> & { id: string }): Article {
  return {
    canonicalUrl: `https://example.test/${overrides.id}`,
    url: `https://example.test/${overrides.id}`,
    title: `Story ${overrides.id}`,
    publishedAt: '2026-10-19T08:00:00.000Z',
    authors: [],
    providerId: 'guardian',
    publisherName: 'The Guardian',
    categoryBasis: 'unknown',
    ...overrides,
  }
}

export function status(
  providerId: ProviderId,
  overrides: Partial<ProviderStatus> = {},
): ProviderStatus {
  return {
    providerId,
    state: 'ok',
    rawCount: 10,
    matchedCount: 10,
    notes: [],
    ...overrides,
  }
}

export function feedPage(overrides: Partial<FeedResponse> = {}): FeedResponse {
  return {
    mode: 'demo',
    articles: [],
    providerStatuses: [status('guardian'), status('nyt'), status('newsapi')],
    nextCursor: null,
    ...overrides,
  }
}
