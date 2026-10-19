import { z } from 'zod'
import { authorKey, cleanAuthorName } from './authors.js'
import { categoryIds, categorySchema } from './categories.js'
import { isCalendarDate } from './dates.js'
import { providerIds, providerIdSchema } from './providers.js'

export const FILTER_LIMITS = {
  queryLength: 100,
  authors: 20,
  authorLength: 80,
} as const

const calendarDate = z
  .string()
  .refine(isCalendarDate, 'Use a real date in YYYY-MM-DD format.')

const authorName = z
  .string()
  .transform(cleanAuthorName)
  .pipe(z.string().min(1).max(FILTER_LIMITS.authorLength))

export const feedFiltersSchema = z
  .object({
    q: z
      .string()
      .transform((value) => value.replace(/\s+/g, ' ').trim())
      .pipe(z.string().max(FILTER_LIMITS.queryLength))
      .default(''),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    sources: z.array(providerIdSchema).default([]),
    categories: z.array(categorySchema).default([]),
    authors: z.array(authorName).max(FILTER_LIMITS.authors).default([]),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to, {
    message: 'The start date must be on or before the end date.',
    path: ['from'],
  })
  .transform(normalizeFilters)

/** Normalized filters: deduplicated, canonically ordered, empty means "any". */
export type FeedFilters = z.output<typeof feedFiltersSchema>

function normalizeFilters(filters: {
  q: string
  from?: string
  to?: string
  sources: (typeof providerIds)[number][]
  categories: (typeof categoryIds)[number][]
  authors: string[]
}) {
  const authors = new Map<string, string>()
  for (const name of filters.authors) {
    const key = authorKey(name)
    if (!authors.has(key)) authors.set(key, name)
  }
  return {
    q: filters.q,
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
    sources: providerIds.filter((id) => filters.sources.includes(id)),
    categories: categoryIds.filter((id) => filters.categories.includes(id)),
    authors: [...authors.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, name]) => name),
  }
}

/** Query keys; lists use repeated keys because author names may contain commas. */
export const FEED_QUERY_KEYS = {
  q: 'q',
  from: 'from',
  to: 'to',
  sources: 'source',
  categories: 'category',
  authors: 'author',
  cursor: 'cursor',
} as const

export function feedFiltersFromParams(params: URLSearchParams) {
  return feedFiltersSchema.safeParse({
    q: params.get(FEED_QUERY_KEYS.q) ?? undefined,
    from: params.get(FEED_QUERY_KEYS.from) || undefined,
    to: params.get(FEED_QUERY_KEYS.to) || undefined,
    sources: params.getAll(FEED_QUERY_KEYS.sources),
    categories: params.getAll(FEED_QUERY_KEYS.categories),
    authors: params.getAll(FEED_QUERY_KEYS.authors),
  })
}

/** Stable serialization of normalized filters; empty values are omitted. */
export function feedFiltersToParams(filters: FeedFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q) params.set(FEED_QUERY_KEYS.q, filters.q)
  if (filters.from) params.set(FEED_QUERY_KEYS.from, filters.from)
  if (filters.to) params.set(FEED_QUERY_KEYS.to, filters.to)
  for (const id of filters.sources) params.append(FEED_QUERY_KEYS.sources, id)
  for (const id of filters.categories)
    params.append(FEED_QUERY_KEYS.categories, id)
  for (const name of filters.authors)
    params.append(FEED_QUERY_KEYS.authors, name)
  return params
}
