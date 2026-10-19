import { utcDayEnd, utcDayStart } from '../../shared/dates.js'
import type { Article } from '../../shared/feed.js'
import type { FeedFilters } from '../../shared/feed-filters.js'
import type { ProviderId } from '../../shared/providers.js'
import {
  MAX_PAGE,
  PAGE_SIZE,
  type ProviderAdapter,
} from '../providers/types.js'
import { buildDemoArticles } from './demo-articles.js'

function matchesNativeFilters(article: Article, filters: FeedFilters) {
  const text = `${article.title} ${article.summary ?? ''}`.toLowerCase()
  const words = filters.q.toLowerCase().split(' ').filter(Boolean)
  if (!words.every((word) => text.includes(word))) return false

  const published = Date.parse(article.publishedAt)
  if (filters.from && published < utcDayStart(filters.from)) return false
  if (filters.to && published > utcDayEnd(filters.to)) return false

  return (
    !filters.categories.length ||
    (article.category !== undefined &&
      filters.categories.includes(article.category))
  )
}

/**
 * In-memory stand-in for a provider: same contract and pagination as Live,
 * without network access. Authors are left to the shared post-filter.
 */
function createDemoAdapter(
  id: ProviderId,
  articles: Article[],
): ProviderAdapter {
  return {
    id,
    maxPage: MAX_PAGE,
    async fetchPage(filters, page) {
      const matches = articles.filter((a) => matchesNativeFilters(a, filters))
      const start = (page - 1) * PAGE_SIZE
      const slice = matches.slice(start, start + PAGE_SIZE)
      return {
        articles: slice,
        rawCount: slice.length,
        hasMore: start + PAGE_SIZE < matches.length,
        notes:
          id === 'newsapi' && filters.categories.length
            ? ['publisher_categories']
            : [],
      }
    },
  }
}

export function createDemoAdapters(
  now: number,
): Record<ProviderId, ProviderAdapter> {
  const articles = buildDemoArticles(now)
  return {
    guardian: createDemoAdapter('guardian', articles.guardian),
    nyt: createDemoAdapter('nyt', articles.nyt),
    newsapi: createDemoAdapter('newsapi', articles.newsapi),
  }
}
