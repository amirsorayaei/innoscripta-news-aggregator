import { useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { feedFiltersToParams, type FeedFilters } from '@shared/feed-filters'
import type { NewsMode } from '@shared/health'
import { fetchFeed } from './feed-api'
import { summarizeFeed } from './feed-state'
import { mergeArticles } from './merge-articles'

/** One pagination stream per mode and normalized filter set. */
export function feedQueryKey(mode: NewsMode, filters: FeedFilters) {
  return ['feed', mode, feedFiltersToParams(filters).toString()] as const
}

export function useFeed(filters: FeedFilters, mode: NewsMode) {
  const queryClient = useQueryClient()
  const queryKey = feedQueryKey(mode, filters)
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchFeed(filters, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const pages = query.data?.pages
  const articles = useMemo(
    () => mergeArticles(pages?.map((page) => page.articles) ?? []),
    [pages],
  )
  const summary = useMemo(() => pages && summarizeFeed(pages), [pages])

  const { fetchNextPage, isFetchingNextPage } = query
  const loadMore = useCallback(() => {
    // A failed page is not stored, so retrying reuses the same cursor.
    if (!isFetchingNextPage) void fetchNextPage({ cancelRefetch: false })
  }, [fetchNextPage, isFetchingNextPage])

  const [, queryMode, queryFilters] = queryKey
  const refresh = useCallback(() => {
    // Resetting drops the old page chain, so only page one is fetched again.
    void queryClient.resetQueries({
      queryKey: ['feed', queryMode, queryFilters],
      exact: true,
    })
  }, [queryClient, queryMode, queryFilters])

  return { query, articles, summary, loadMore, refresh }
}
