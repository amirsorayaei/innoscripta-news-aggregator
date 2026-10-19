import { feedResponseSchema } from '@shared/feed'
import {
  FEED_QUERY_KEYS,
  feedFiltersToParams,
  type FeedFilters,
} from '@shared/feed-filters'
import { getJson } from '@/lib/api-client'

export function fetchFeed(
  filters: FeedFilters,
  cursor: string | undefined,
  signal: AbortSignal,
) {
  const params = feedFiltersToParams(filters)
  if (cursor) params.set(FEED_QUERY_KEYS.cursor, cursor)
  const query = params.toString()
  return getJson(
    `/api/feed${query ? `?${query}` : ''}`,
    feedResponseSchema,
    signal,
  )
}
