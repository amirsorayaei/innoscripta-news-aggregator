import { useEffect, useMemo, useReducer } from 'react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type { FeedResponse } from '@shared/feed'
import { useAppMode } from '@/features/app-mode/useAppMode'
import { collectAuthors } from './authors'

/**
 * Authors from feed pages already in the query cache for the current mode.
 * Nothing is fetched for suggestions; they refresh when a cached feed updates.
 */
export function useAuthorSuggestions() {
  const queryClient = useQueryClient()
  const mode = useAppMode().data?.mode
  const [cacheVersion, cacheUpdated] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!mode) return
    return queryClient.getQueryCache().subscribe((event) => {
      const [scope, eventMode] = event.query.queryKey
      if (
        event.type === 'updated' &&
        event.action.type === 'success' &&
        scope === 'feed' &&
        eventMode === mode
      ) {
        cacheUpdated()
      }
    })
  }, [queryClient, mode])

  return useMemo(() => {
    if (!mode || cacheVersion < 0) return []
    const feeds = queryClient
      .getQueriesData<InfiniteData<FeedResponse>>({ queryKey: ['feed', mode] })
      .map(([, data]) => data)
    return collectAuthors(feeds)
  }, [queryClient, mode, cacheVersion])
}
