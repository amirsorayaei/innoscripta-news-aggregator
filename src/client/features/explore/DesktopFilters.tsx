import { useState } from 'react'
import type { FeedFilters } from '@shared/feed-filters'
import { exploreSearch } from './explore-url'
import {
  dateRangeError,
  toDraft,
  withDraft,
  type FilterDraft,
} from './filter-draft'
import { FilterFields } from './FilterFields'

interface DesktopFiltersProps {
  filters: FeedFilters
  onApply: (filters: FeedFilters) => void
}

/** Inline filters that apply as soon as the values are valid. */
export function DesktopFilters({ filters, onApply }: DesktopFiltersProps) {
  const [draft, setDraft] = useState(() => toDraft(filters))
  const appliedKey = exploreSearch(filters)
  const [syncedKey, setSyncedKey] = useState(appliedKey)

  // Back/Forward or a removed chip changes the applied filters; mirror them.
  if (appliedKey !== syncedKey) {
    setSyncedKey(appliedKey)
    setDraft(toDraft(filters))
  }

  const error = dateRangeError(draft)
  const change = (next: FilterDraft) => {
    setDraft(next)
    if (!dateRangeError(next)) onApply(withDraft(filters, next))
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <FilterFields
        value={draft}
        onChange={change}
        dateError={error}
        idPrefix="desktop-filters"
        compact
      />
    </div>
  )
}
