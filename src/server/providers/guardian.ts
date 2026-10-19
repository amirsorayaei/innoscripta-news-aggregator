import { z } from 'zod'
import type { Category } from '../../shared/categories.js'
import type { FeedFilters } from '../../shared/feed-filters.js'
import { errorCodeForStatus, getUpstreamJson } from './http.js'
import { parseByline, toArticle } from './normalize.js'
import {
  MAX_PAGE,
  PAGE_SIZE,
  ProviderError,
  parseItems,
  type ProviderAdapter,
  type ProviderPage,
} from './types.js'

const ENDPOINT = 'https://content.guardianapis.com/search'

/**
 * Categories map to keyword tags joined with "|" (OR). Guardian ANDs `section`
 * with `tag`, so tags are the one filter that can combine health with others.
 */
export const guardianCategoryTags: Record<Category, string[]> = {
  general: ['world/world', 'uk/uk', 'us-news/us-news'],
  business: ['business/business'],
  technology: ['technology/technology'],
  science: ['science/science'],
  health: ['society/health'],
  sports: ['sport/sport'],
  entertainment: ['culture/culture'],
}

const sectionCategories: Record<string, Category> = {
  world: 'general',
  'uk-news': 'general',
  'us-news': 'general',
  'australia-news': 'general',
  business: 'business',
  technology: 'technology',
  science: 'science',
  sport: 'sports',
  football: 'sports',
  culture: 'entertainment',
  film: 'entertainment',
  music: 'entertainment',
  'tv-and-radio': 'entertainment',
  books: 'entertainment',
  stage: 'entertainment',
  artanddesign: 'entertainment',
  games: 'entertainment',
}

const responseSchema = z.object({
  response: z.object({
    status: z.literal('ok'),
    currentPage: z.number().int(),
    pages: z.number().int(),
    results: z.array(z.unknown()),
  }),
})

const resultSchema = z.object({
  sectionId: z.string().optional(),
  webTitle: z.string(),
  webUrl: z.string(),
  webPublicationDate: z.string(),
  fields: z
    .object({
      trailText: z.string().optional(),
      thumbnail: z.string().optional(),
      byline: z.string().optional(),
    })
    .optional(),
  tags: z
    .array(z.object({ id: z.string(), type: z.string(), webTitle: z.string() }))
    .optional(),
})

export function buildGuardianUrl(
  filters: FeedFilters,
  page: number,
  apiKey: string,
): URL {
  const url = new URL(ENDPOINT)
  const params = url.searchParams
  if (filters.q) params.set('q', filters.q)
  if (filters.from) params.set('from-date', filters.from)
  if (filters.to) params.set('to-date', filters.to)
  if (filters.categories.length) {
    const tags = filters.categories.flatMap((c) => guardianCategoryTags[c])
    params.set('tag', tags.join('|'))
  }
  params.set('order-by', 'newest')
  params.set('page', String(page))
  params.set('page-size', String(PAGE_SIZE))
  params.set('show-fields', 'trailText,thumbnail,byline')
  params.set('show-tags', 'contributor,keyword')
  params.set('api-key', apiKey)
  return url
}

function categoryFor(result: z.infer<typeof resultSchema>) {
  if (result.tags?.some((tag) => tag.id === 'society/health')) return 'health'
  return result.sectionId ? sectionCategories[result.sectionId] : undefined
}

function mapResult(item: unknown) {
  const parsed = resultSchema.safeParse(item)
  if (!parsed.success) return undefined
  const result = parsed.data
  const contributors = (result.tags ?? [])
    .filter((tag) => tag.type === 'contributor')
    .map((tag) => tag.webTitle)

  return toArticle({
    url: result.webUrl,
    title: result.webTitle,
    publishedAt: result.webPublicationDate,
    summary: result.fields?.trailText,
    imageUrl: result.fields?.thumbnail,
    authors: contributors.length
      ? contributors
      : parseByline(result.fields?.byline),
    providerId: 'guardian',
    publisherName: 'The Guardian',
    category: categoryFor(result),
    categoryBasis: 'article',
  })
}

export function mapGuardianResponse(body: unknown, page: number): ProviderPage {
  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) throw new ProviderError('invalid_response')
  const { results, currentPage, pages } = parsed.data.response

  return {
    articles: parseItems(results, mapResult),
    rawCount: results.length,
    hasMore: currentPage < pages && page < MAX_PAGE,
    notes: [],
  }
}

export function createGuardianAdapter(apiKey: string): ProviderAdapter {
  return {
    id: 'guardian',
    maxPage: MAX_PAGE,
    async fetchPage(filters, page, signal) {
      const url = buildGuardianUrl(filters, page, apiKey)
      const { status, body } = await getUpstreamJson(url, signal)
      if (status !== 200) throw new ProviderError(errorCodeForStatus(status))
      return mapGuardianResponse(body, page)
    },
  }
}
