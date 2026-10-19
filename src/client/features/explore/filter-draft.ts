import type { Category } from '@shared/categories'
import { isCalendarDate } from '@shared/dates'
import type { FeedFilters } from '@shared/feed-filters'
import type { ProviderId } from '@shared/providers'

/** Editable filter values; the keyword is edited separately in the search box. */
export interface FilterDraft {
  sources: ProviderId[]
  categories: Category[]
  from: string
  to: string
}

export const EMPTY_DRAFT: FilterDraft = {
  sources: [],
  categories: [],
  from: '',
  to: '',
}

export function toDraft(filters: FeedFilters): FilterDraft {
  return {
    sources: filters.sources,
    categories: filters.categories,
    from: filters.from ?? '',
    to: filters.to ?? '',
  }
}

export function withDraft(
  filters: FeedFilters,
  draft: FilterDraft,
): FeedFilters {
  return {
    ...filters,
    sources: draft.sources,
    categories: draft.categories,
    from: draft.from || undefined,
    to: draft.to || undefined,
  }
}

export function dateRangeError({ from, to }: FilterDraft) {
  if (from && !isCalendarDate(from)) return 'Enter a valid start date.'
  if (to && !isCalendarDate(to)) return 'Enter a valid end date.'
  if (from && to && from > to)
    return 'The start date must be on or before the end date.'
  return undefined
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value]
}

export function countDraftFilters(draft: FilterDraft) {
  return (
    draft.sources.length +
    draft.categories.length +
    Number(Boolean(draft.from)) +
    Number(Boolean(draft.to))
  )
}
