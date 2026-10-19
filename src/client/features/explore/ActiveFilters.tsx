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

/** The applied filters as removable chips, with a way to clear them all. */
export function ActiveFilters({ filters, onApply }: ActiveFiltersProps) {
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
      <ul className="flex flex-wrap gap-2">
        {chips.map(({ label, remove }) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => onApply({ ...filters, ...remove })}
              aria-label={`Remove filter ${label}`}
              className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full bg-accent px-3 text-sm text-accent-foreground hover:bg-accent/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="truncate">{label}</span>
              <X aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="link"
        className="min-h-9 px-1"
        onClick={() => onApply(EMPTY_FILTERS)}
      >
        Clear all
      </Button>
    </div>
  )
}
