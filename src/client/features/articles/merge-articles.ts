import type { Article } from '@shared/feed'
import { providerIds, type ProviderId } from '@shared/providers'

/** An article as displayed: one per canonical URL, with every provider that returned it. */
export interface FeedArticle extends Article {
  /** Providers that returned this canonical URL, in priority order. */
  providers: ProviderId[]
}

// providerIds is ordered Guardian, NYT, NewsAPI, which is also the display priority.
const priority = (id: ProviderId) => providerIds.indexOf(id)

/**
 * Merges fetched batches into one list: duplicates share an ID (a hash of the
 * canonical URL), the highest-priority copy wins, and missing optional fields
 * are filled from other copies. Sorted newest first, then by ID.
 */
export function mergeArticles(batches: Article[][]): FeedArticle[] {
  const copiesById = new Map<string, Article[]>()
  for (const article of batches.flat()) {
    const copies = copiesById.get(article.id)
    if (copies) copies.push(article)
    else copiesById.set(article.id, [article])
  }
  return [...copiesById.values()].map(mergeCopies).sort(newestFirst)
}

function mergeCopies(copies: Article[]): FeedArticle {
  const ordered = [...copies].sort(
    (a, b) => priority(a.providerId) - priority(b.providerId),
  )
  const primary = ordered[0]!
  const summary = ordered.find((c) => c.summary)?.summary
  const imageUrl = ordered.find((c) => c.imageUrl)?.imageUrl
  const authors = ordered.find((c) => c.authors.length)?.authors ?? []
  // A category keeps the basis it came with, so a publisher category stays one.
  const categorized = ordered.find((c) => c.category)

  return {
    ...primary,
    ...(summary && { summary }),
    ...(imageUrl && { imageUrl }),
    authors,
    category: categorized?.category,
    categoryBasis: categorized?.categoryBasis ?? 'unknown',
    providers: [...new Set(ordered.map((c) => c.providerId))],
  }
}

function newestFirst(a: Article, b: Article) {
  if (a.publishedAt !== b.publishedAt) {
    return a.publishedAt < b.publishedAt ? 1 : -1
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
