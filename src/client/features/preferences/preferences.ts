import { z } from 'zod'
import {
  feedFiltersSchema,
  feedFiltersToParams,
  type FeedFilters,
} from '@shared/feed-filters'

/** Saved feed preferences: OR within each group, AND between groups. */
export type Preferences = Pick<
  FeedFilters,
  'sources' | 'categories' | 'authors'
>

export const PREFERENCES_STORAGE_KEY = 'news-desk.preferences'
export const PREFERENCES_SCHEMA_VERSION = 1

export const EMPTY_PREFERENCES: Preferences = {
  sources: [],
  categories: [],
  authors: [],
}

const storedSchema = z.object({
  schemaVersion: z.literal(PREFERENCES_SCHEMA_VERSION),
  preferences: z.object({
    sources: z.array(z.string()),
    categories: z.array(z.string()),
    authors: z.array(z.string()),
  }),
})

/**
 * Validates and normalizes preferences with the shared filter contract, so
 * IDs, author names and limits match what the feed API accepts.
 */
export function parsePreferences(input: unknown): Preferences | undefined {
  const parsed = feedFiltersSchema.safeParse(input)
  if (!parsed.success) return undefined
  const { sources, categories, authors } = parsed.data
  return { sources, categories, authors }
}

/** Stored JSON → preferences. Anything malformed, invalid or from another version → empty. */
export function preferencesFromStorage(raw: string | null): Preferences {
  if (raw === null) return EMPTY_PREFERENCES
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return EMPTY_PREFERENCES
  }
  const stored = storedSchema.safeParse(json)
  if (!stored.success) return EMPTY_PREFERENCES
  return parsePreferences(stored.data.preferences) ?? EMPTY_PREFERENCES
}

export function preferencesToStorage(preferences: Preferences) {
  return JSON.stringify({
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    preferences,
  })
}

/** My Feed's filters: only the saved groups, never Explore's keyword or dates. */
export function preferencesToFilters({
  sources,
  categories,
  authors,
}: Preferences): FeedFilters {
  return feedFiltersSchema.parse({ sources, categories, authors })
}

export function isEmptyPreferences(p: Preferences) {
  return !p.sources.length && !p.categories.length && !p.authors.length
}

export function samePreferences(a: Preferences, b: Preferences) {
  return (
    feedFiltersToParams(preferencesToFilters(a)).toString() ===
    feedFiltersToParams(preferencesToFilters(b)).toString()
  )
}
