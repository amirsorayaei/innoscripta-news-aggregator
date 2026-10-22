import { categoryIds, categoryLabels } from '@shared/categories'
import { providerIds, providerNames } from '@shared/providers'
import { ToggleChip } from '@/components/ToggleChip'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toggle, type FilterDraft } from './filter-draft'

interface FilterFieldsProps {
  value: FilterDraft
  onChange: (next: FilterDraft) => void
  dateError?: string
  /** Called when a date field is left or Enter is pressed in it. */
  onDateCommit?: () => void
  /** Prefix for element IDs, so desktop and mobile instances never collide. */
  idPrefix: string
  /** Smaller controls for pointer-first desktop layouts. */
  compact?: boolean
}

export function FilterFields({
  value,
  onChange,
  dateError,
  onDateCommit,
  idPrefix,
  compact,
}: FilterFieldsProps) {
  const hintId = `${idPrefix}-date-hint`
  const errorId = `${idPrefix}-date-error`
  const describedBy = dateError ? `${errorId} ${hintId}` : hintId
  const control = compact ? 'min-h-11 lg:min-h-9' : 'min-h-11'

  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        compact && 'xl:flex-row xl:flex-wrap xl:gap-x-8',
      )}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Sources</legend>
        <div className="flex flex-wrap gap-2">
          {providerIds.map((id) => (
            <ToggleChip
              key={id}
              className={control}
              pressed={value.sources.includes(id)}
              onClick={() =>
                onChange({ ...value, sources: toggle(value.sources, id) })
              }
            >
              {providerNames[id]}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Categories</legend>
        <div className="flex flex-wrap gap-2">
          {categoryIds.map((id) => (
            <ToggleChip
              key={id}
              className={control}
              pressed={value.categories.includes(id)}
              onClick={() =>
                onChange({ ...value, categories: toggle(value.categories, id) })
              }
            >
              {categoryLabels[id]}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Published</legend>
        <div className="flex flex-wrap gap-3">
          {(['from', 'to'] as const).map((field) => (
            <div key={field} className="flex flex-col gap-1">
              <label
                htmlFor={`${idPrefix}-${field}`}
                className="text-xs text-muted-foreground"
              >
                {field === 'from' ? 'From' : 'To'}
              </label>
              <Input
                id={`${idPrefix}-${field}`}
                type="date"
                value={value[field]}
                onChange={(event) =>
                  onChange({ ...value, [field]: event.target.value })
                }
                onBlur={onDateCommit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onDateCommit?.()
                }}
                aria-invalid={dateError ? true : undefined}
                aria-describedby={describedBy}
                className={cn('w-40', control)}
              />
            </div>
          ))}
        </div>
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          Whole days in UTC, both dates included.
        </p>
        <p id={errorId} aria-live="polite" className="text-sm text-destructive">
          {dateError}
        </p>
      </fieldset>
    </div>
  )
}
