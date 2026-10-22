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

/**
 * Inline filters. Sources and categories apply on click. Dates apply when the
 * field is left or Enter is pressed, so the intermediate values a browser
 * reports while a date is typed (such as year 202) never reach the URL. While
 * the typed range is invalid, clicks still apply with the last applied dates.
 */
export function DesktopFilters({ filters, onApply }: DesktopFiltersProps) {
  const [draft, setDraft] = useState(() => toDraft(filters))
  const [showDateError, setShowDateError] = useState(false)
  const appliedKey = exploreSearch(filters)
  const [syncedKey, setSyncedKey] = useState(appliedKey)
  const [ownKey, setOwnKey] = useState<string>()

  // Back/Forward or a removed chip changes the applied filters; mirror them.
  // The navigation this form just made keeps the draft, including unapplied
  // dates. Its key is consumed on arrival, so a later Back/Forward to the same
  // URL still mirrors the restored filters.
  if (appliedKey !== syncedKey) {
    setSyncedKey(appliedKey)
    if (appliedKey === ownKey) {
      setOwnKey(undefined)
    } else {
      setDraft(toDraft(filters))
      setShowDateError(false)
    }
  }

  const error = dateRangeError(draft)

  const apply = (next: FilterDraft) => {
    const dates = dateRangeError(next) ? toDraft(filters) : next
    const applied = withDraft(filters, {
      ...next,
      from: dates.from,
      to: dates.to,
    })
    const key = exploreSearch(applied)
    // An unchanged key causes no navigation, so there is nothing to consume.
    if (key !== appliedKey) setOwnKey(key)
    onApply(applied)
  }

  const change = (next: FilterDraft) => {
    setDraft(next)
    const datesChanged = next.from !== draft.from || next.to !== draft.to
    // Errors wait for the next commit, so typing never flashes them.
    if (datesChanged) setShowDateError(false)
    else apply(next)
  }

  const commitDates = () => {
    setShowDateError(Boolean(error))
    if (!error) apply(draft)
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <FilterFields
        value={draft}
        onChange={change}
        dateError={showDateError ? error : undefined}
        onDateCommit={commitDates}
        idPrefix="desktop-filters"
        compact
      />
    </div>
  )
}
