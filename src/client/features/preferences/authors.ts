import type { InfiniteData } from '@tanstack/react-query'
import { authorKey, cleanAuthorName } from '@shared/authors'
import type { FeedResponse } from '@shared/feed'
import { FILTER_LIMITS } from '@shared/feed-filters'

export interface AuthorSuggestion {
  name: string
  /** Number of cached articles crediting this author. */
  count: number
}

/**
 * Distinct authors from cached feed pages, most frequent first. Names are
 * matched by authorKey (no fuzzy matching) and shown in their cleaned form.
 */
export function collectAuthors(
  feeds: (InfiniteData<FeedResponse> | undefined)[],
): AuthorSuggestion[] {
  const byKey = new Map<string, AuthorSuggestion>()
  for (const feed of feeds) {
    for (const page of feed?.pages ?? []) {
      for (const article of page.articles) {
        for (const raw of article.authors) {
          const name = cleanAuthorName(raw)
          if (!name || name.length > FILTER_LIMITS.authorLength) continue
          const key = authorKey(name)
          const existing = byKey.get(key)
          if (existing) existing.count++
          else byKey.set(key, { name, count: 1 })
        }
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )
}

/** Error message for adding `input` to `selected`, or undefined when it can be added. */
export function authorEntryError(input: string, selected: string[]) {
  const name = cleanAuthorName(input)
  if (!name) return 'Enter an author’s full name.'
  if (name.length > FILTER_LIMITS.authorLength) {
    return `Author names can be at most ${FILTER_LIMITS.authorLength} characters.`
  }
  const key = authorKey(name)
  const duplicate = selected.find((existing) => authorKey(existing) === key)
  if (duplicate) return `${duplicate} is already selected.`
  if (selected.length >= FILTER_LIMITS.authors) {
    return `You can follow up to ${FILTER_LIMITS.authors} authors.`
  }
  return undefined
}
