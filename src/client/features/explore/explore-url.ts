import { categorySchema } from '@shared/categories'
import { isCalendarDate } from '@shared/dates'
import {
  FEED_QUERY_KEYS,
  FILTER_LIMITS,
  feedFiltersSchema,
  feedFiltersToParams,
  type FeedFilters,
} from '@shared/feed-filters'
import { providerIdSchema } from '@shared/providers'

export function normalizeQuery(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FILTER_LIMITS.queryLength)
    .trim()
}

/**
 * Lenient reading of Explore's URL. Each value is checked on its own, so one
 * bad value never discards the others: unknown sources and categories and
 * invalid dates are dropped, a reversed date range drops both dates, long
 * keywords are truncated. Authors are not an Explore filter and are ignored.
 */
export function exploreFiltersFromParams(params: URLSearchParams): FeedFilters {
  const date = (key: string) => {
    const value = params.get(key)
    return value && isCalendarDate(value) ? value : undefined
  }
  let from = date(FEED_QUERY_KEYS.from)
  let to = date(FEED_QUERY_KEYS.to)
  if (from && to && from > to) from = to = undefined

  return feedFiltersSchema.parse({
    q: normalizeQuery(params.get(FEED_QUERY_KEYS.q) ?? ''),
    from,
    to,
    sources: params
      .getAll(FEED_QUERY_KEYS.sources)
      .filter((v) => providerIdSchema.safeParse(v).success),
    categories: params
      .getAll(FEED_QUERY_KEYS.categories)
      .filter((v) => categorySchema.safeParse(v).success),
    authors: [],
  })
}

/** The single URL form for a set of Explore filters. */
export function exploreSearch(filters: FeedFilters) {
  return feedFiltersToParams({ ...filters, authors: [] }).toString()
}

export function hasActiveFilters(filters: FeedFilters) {
  return Boolean(
    filters.q ||
    filters.from ||
    filters.to ||
    filters.sources.length ||
    filters.categories.length,
  )
}

export const EMPTY_FILTERS: FeedFilters = feedFiltersSchema.parse({})
