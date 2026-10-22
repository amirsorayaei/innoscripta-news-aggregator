import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { categoryLabels } from '@shared/categories'
import type { FeedFilters } from '@shared/feed-filters'
import { providerNames } from '@shared/providers'
import { Button } from '@/components/ui/button'
import { EMPTY_FILTERS, hasActiveFilters } from './explore-url'

interface ActiveFiltersProps {
  filters: FeedFilters
  onApply: (filters: FeedFilters) => void
}

/**
 * The applied filters as removable chips, with a way to clear them all.
 * Removing a chip moves focus to the chip now in its place (or the last one);
 * with none left, focus returns to the search box.
 */
export function ActiveFilters({ filters, onApply }: ActiveFiltersProps) {
  const list = useRef<HTMLUListElement>(null)
  const focusIndex = useRef<number | undefined>(undefined)

  useEffect(() => {
    const index = focusIndex.current
    if (index === undefined) return
    focusIndex.current = undefined
    const chips = list.current?.querySelectorAll('button') ?? []
    const target = chips[Math.min(index, chips.length - 1)]
    ;(target ?? document.getElementById('explore-search'))?.focus()
  }, [filters])

  if (!hasActiveFilters(filters)) return null

  const chips = [
    ...(filters.q ? [{ label: `“${filters.q}”`, remove: { q: '' } }] : []),
    ...filters.sources.map((id) => ({
      label: providerNames[id],
      remove: { sources: filters.sources.filter((s) => s !== id) },
    })),
    ...filters.categories.map((id) => ({
      label: categoryLabels[id],
      remove: { categories: filters.categories.filter((c) => c !== id) },
    })),
    ...(filters.from
      ? [{ label: `From ${filters.from}`, remove: { from: undefined } }]
      : []),
    ...(filters.to
      ? [{ label: `To ${filters.to}`, remove: { to: undefined } }]
      : []),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-sm text-muted-foreground">Applied:</h2>
      {/* min-w-0 on each flex level lets a long label truncate instead of widening the page. */}
      <ul ref={list} className="flex max-w-full min-w-0 flex-wrap gap-2">
        {chips.map(({ label, remove }, index) => (
          <li key={label} className="max-w-full min-w-0">
            <button
              type="button"
              onClick={() => {
                focusIndex.current = index
                onApply({ ...filters, ...remove })
              }}
              aria-label={`Remove filter ${label}`}
              title={label}
              className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-full bg-accent lg:min-h-9 px-3 text-sm text-accent-foreground hover:bg-accent/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="truncate">{label}</span>
              <X aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="link"
        className="min-h-11 px-1 lg:min-h-9"
        onClick={() => {
          focusIndex.current = -1
          onApply(EMPTY_FILTERS)
        }}
      >
        Clear all
      </Button>
    </div>
  )
}
