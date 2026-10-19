import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { FeedFilters } from '@shared/feed-filters'
import { exploreFiltersFromParams, exploreSearch } from './explore-url'

/**
 * Explore's applied filters live in the URL. Non-canonical URLs are replaced
 * once with their sanitized form; applying filters pushes a history entry so
 * Back and Forward restore earlier results.
 */
export function useExploreFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const current = searchParams.toString()
  const filters = useMemo(
    () => exploreFiltersFromParams(new URLSearchParams(current)),
    [current],
  )
  const canonical = exploreSearch(filters)

  useEffect(() => {
    // exploreSearch is idempotent, so this replaces at most once.
    if (canonical !== current) {
      setSearchParams(new URLSearchParams(canonical), { replace: true })
    }
  }, [canonical, current, setSearchParams])

  const applyFilters = useCallback(
    (next: FeedFilters) => {
      const search = exploreSearch(
        exploreFiltersFromParams(new URLSearchParams(exploreSearch(next))),
      )
      if (search !== canonical) setSearchParams(new URLSearchParams(search))
    },
    [canonical, setSearchParams],
  )

  return { filters, applyFilters }
}
