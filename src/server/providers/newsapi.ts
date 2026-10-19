import { z } from 'zod'
import { categoryIds, type Category } from '../../shared/categories.js'
import { toUtcDate } from '../../shared/dates.js'
import type { ProviderNote } from '../../shared/feed.js'
import type { FeedFilters } from '../../shared/feed-filters.js'
import { getUpstreamJson } from './http.js'
import { parseByline, toArticle } from './normalize.js'
import {
  MAX_PAGE,
  PAGE_SIZE,
  ProviderError,
  ProviderLimitReached,
  parseItems,
  type ProviderAdapter,
  type ProviderPage,
} from './types.js'

const ENDPOINT = 'https://newsapi.org/v2/everything'
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * /v2/everything has no category filter, so categories map to a small, fixed
 * set of English publishers (at most 20 IDs, the `sources` limit). This is a
 * publisher category, not a guarantee about each article's topic.
 */
export const newsApiCategorySources: Record<Category, string[]> = {
  general: ['bbc-news', 'associated-press', 'reuters'],
  business: ['bloomberg', 'business-insider', 'fortune'],
  technology: ['techcrunch', 'the-verge', 'wired'],
  science: ['new-scientist', 'national-geographic'],
  health: ['medical-news-today'],
  sports: ['espn', 'bbc-sport', 'talksport'],
  entertainment: ['entertainment-weekly', 'ign', 'buzzfeed'],
}

const sourceCategories = new Map<string, Category>(
  Object.entries(newsApiCategorySources).flatMap(([category, ids]) =>
    ids.map((id) => [id, category as Category] as const),
  ),
)

/** Developer plan: articles up to one month old (newsapi.org/pricing). */
export const NEWSAPI_HISTORY_DAYS = 30

const successSchema = z.object({
  status: z.literal('ok'),
  totalResults: z.number().int(),
  articles: z.array(z.unknown()),
})

const errorSchema = z.object({ status: z.literal('error'), code: z.string() })

const articleSchema = z.object({
  source: z.object({ id: z.string().nullish(), name: z.string().nullish() }),
  author: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  url: z.string().nullish(),
  urlToImage: z.string().nullish(),
  publishedAt: z.string().nullish(),
})

export function oldestSearchableDate(now: number): string {
  return toUtcDate(now - NEWSAPI_HISTORY_DAYS * DAY_MS)
}

export function buildNewsApiRequest(
  filters: FeedFilters,
  page: number,
  now: number,
) {
  const url = new URL(ENDPOINT)
  const params = url.searchParams
  const notes: ProviderNote[] = []

  const categories = filters.categories.length
    ? filters.categories
    : categoryIds
  const sources = categories.flatMap((c) => newsApiCategorySources[c])
  // With `sources` set, `q` is optional; it is omitted when there is no keyword.
  if (filters.q) params.set('q', filters.q)
  params.set('sources', sources.join(','))
  if (filters.categories.length) notes.push('publisher_categories')

  const oldest = oldestSearchableDate(now)
  if (filters.from && filters.from < oldest) {
    params.set('from', oldest)
    notes.push('date_range_clamped')
  } else if (filters.from) {
    params.set('from', filters.from)
  }
  if (filters.to) params.set('to', `${filters.to}T23:59:59`)

  params.set('language', 'en')
  params.set('sortBy', 'publishedAt')
  params.set('pageSize', String(PAGE_SIZE))
  params.set('page', String(page))
  return { url, notes }
}

function mapArticle(item: unknown) {
  const parsed = articleSchema.safeParse(item)
  if (!parsed.success) return undefined
  const article = parsed.data
  // NewsAPI keeps placeholders for articles withdrawn by publishers.
  if (article.title === '[Removed]') return undefined

  const sourceId = article.source.id ?? undefined
  return toArticle({
    url: article.url,
    title: article.title,
    publishedAt: article.publishedAt,
    summary: article.description,
    imageUrl: article.urlToImage,
    authors: parseByline(article.author),
    providerId: 'newsapi',
    publisherName: article.source.name ?? 'Unknown publisher',
    category: sourceId ? sourceCategories.get(sourceId) : undefined,
    categoryBasis: 'publisher',
  })
}

function errorFor(status: number, body: unknown): Error {
  const code = errorSchema.safeParse(body).data?.code
  if (code === 'maximumResultsReached') {
    return new ProviderLimitReached('result_limit_reached')
  }
  if (code?.startsWith('apiKey') && code !== 'apiKeyExhausted') {
    return new ProviderError('unauthorized')
  }
  if (status === 429 || code === 'rateLimited' || code === 'apiKeyExhausted') {
    return new ProviderError('rate_limited')
  }
  if (status === 401 || status === 403) return new ProviderError('unauthorized')
  if (status >= 500) return new ProviderError('upstream_unavailable')
  return new ProviderError('bad_request')
}

export function mapNewsApiResponse(
  body: unknown,
  page: number,
  notes: ProviderNote[],
): ProviderPage {
  const parsed = successSchema.safeParse(body)
  if (!parsed.success) throw new ProviderError('invalid_response')
  const { articles, totalResults } = parsed.data

  return {
    articles: parseItems(articles, mapArticle),
    rawCount: articles.length,
    hasMore: page * PAGE_SIZE < totalResults && page < MAX_PAGE,
    notes,
  }
}

export function createNewsApiAdapter(
  apiKey: string,
  now: () => number = Date.now,
): ProviderAdapter {
  return {
    id: 'newsapi',
    maxPage: MAX_PAGE,
    unavailableFor(filters) {
      return filters.to && filters.to < oldestSearchableDate(now())
        ? 'date_out_of_range'
        : undefined
    },
    async fetchPage(filters, page, signal) {
      const { url, notes } = buildNewsApiRequest(filters, page, now())
      // The key goes in a header so it never appears in the URL.
      const { status, body } = await getUpstreamJson(url, signal, {
        'X-Api-Key': apiKey,
      })
      if (status !== 200) throw errorFor(status, body)
      return mapNewsApiResponse(body, page, notes)
    },
  }
}
