import { useState } from 'react'
import { useLocation } from 'react-router'
import { SlidersHorizontal } from 'lucide-react'
import type { FeedFilters } from '@shared/feed-filters'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  countDraftFilters,
  dateRangeError,
  EMPTY_DRAFT,
  toDraft,
  withDraft,
} from './filter-draft'
import { FilterFields } from './FilterFields'

interface MobileFiltersProps {
  filters: FeedFilters
  onApply: (filters: FeedFilters) => void
}

/**
 * Filters in a Sheet with a private draft: opening copies the applied filters,
 * Apply commits them together, and closing any other way discards the draft.
 * Navigating while the Sheet is open (e.g. Back) closes it, so a draft based
 * on the previous page can never be applied.
 */
export function MobileFilters({ filters, onApply }: MobileFiltersProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => toDraft(filters))
  const { key: locationKey } = useLocation()
  const [openedAt, setOpenedAt] = useState(locationKey)
  if (locationKey !== openedAt) {
    setOpenedAt(locationKey)
    if (open) setOpen(false)
  }
  const applied = countDraftFilters(toDraft(filters))
  const error = dateRangeError(draft)

  const changeOpen = (next: boolean) => {
    if (next) setDraft(toDraft(filters))
    setOpen(next)
  }

  const apply = () => {
    if (error) return
    onApply(withDraft(filters, draft))
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" className="min-h-11 shrink-0">
          <SlidersHorizontal aria-hidden="true" />
          Filters
          {applied > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {applied}
              <span className="sr-only"> applied</span>
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Changes apply when you choose Apply.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <FilterFields
            value={draft}
            onChange={setDraft}
            dateError={error}
            idPrefix="mobile-filters"
          />
        </div>
        <SheetFooter className="flex-row flex-wrap border-t">
          <Button
            variant="ghost"
            size="lg"
            className="min-h-11"
            onClick={() => setDraft(EMPTY_DRAFT)}
          >
            Reset
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="lg"
              className="min-h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="min-h-11"
              onClick={apply}
              disabled={Boolean(error)}
            >
              Apply
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
