import { useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { ArticleFeed } from '@/features/articles/ArticleFeed'
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query'
import { ActiveFilters } from './ActiveFilters'
import { DesktopFilters } from './DesktopFilters'
import { EMPTY_FILTERS, hasActiveFilters } from './explore-url'
import { MobileFilters } from './MobileFilters'
import { SearchBar } from './SearchBar'
import { useExploreFilters } from './use-explore-filters'

export function ExplorePage() {
  const { filters, applyFilters } = useExploreFilters()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const commitQuery = useCallback(
    (q: string) => applyFilters({ ...filters, q }),
    [applyFilters, filters],
  )

  return (
    <>
      <PageHeader
        title="Explore"
        description="Search and filter recent articles from The Guardian, The New York Times and NewsAPI."
      />
      <section aria-label="Search and filters" className="mb-6 space-y-3">
        <div className="flex gap-2">
          <SearchBar applied={filters.q} onCommit={commitQuery} />
          {!isDesktop && (
            <MobileFilters filters={filters} onApply={applyFilters} />
          )}
        </div>
        {isDesktop && (
          <DesktopFilters filters={filters} onApply={applyFilters} />
        )}
        <ActiveFilters filters={filters} onApply={applyFilters} />
      </section>
      <ArticleFeed
        filters={filters}
        emptyAction={
          hasActiveFilters(filters) && (
            <Button
              variant="outline"
              size="lg"
              className="min-h-11"
              onClick={() => applyFilters(EMPTY_FILTERS)}
            >
              Clear filters
            </Button>
          )
        }
      />
    </>
  )
}
