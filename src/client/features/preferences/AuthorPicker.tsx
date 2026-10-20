import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { authorKey, cleanAuthorName } from '@shared/authors'
import { FILTER_LIMITS } from '@shared/feed-filters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authorEntryError } from './authors'
import { useAuthorSuggestions } from './use-author-suggestions'

const MAX_SUGGESTIONS = 12

interface AuthorPickerProps {
  selected: string[]
  onChange: (authors: string[]) => void
}

export function AuthorPicker({ selected, onChange }: AuthorPickerProps) {
  const id = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const suggestions = useAuthorSuggestions()

  const selectedKeys = new Set(selected.map(authorKey))
  const query = authorKey(text)
  const visible = suggestions
    .filter((s) => !selectedKeys.has(authorKey(s.name)))
    .filter((s) => !query || authorKey(s.name).includes(query))
    .slice(0, MAX_SUGGESTIONS)

  const add = (name: string) => {
    const problem = authorEntryError(name, selected)
    setError(problem)
    if (problem) return
    onChange([...selected, cleanAuthorName(name)])
    setText('')
  }

  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  return (
    <fieldset className="space-y-4">
      <legend className="text-base font-semibold">Authors</legend>
      <p id={hintId} className="text-sm text-muted-foreground">
        Add full names. A name matches when it is the same after ignoring case
        and spacing, checked within the articles each source returns. This is
        not a full author search, so a missing suggestion doesn’t mean the
        author doesn’t exist.
      </p>

      {selected.length > 0 ? (
        <ul aria-label="Selected authors" className="flex flex-wrap gap-2">
          {selected.map((name) => (
            <li key={authorKey(name)} className="max-w-full min-w-0">
              <span className="inline-flex max-w-full items-center gap-1 rounded-2xl bg-accent py-1 pr-1 pl-3 text-sm text-accent-foreground">
                <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((n) => n !== name))}
                  aria-label={`Remove ${name}`}
                  className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-accent-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No authors selected.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {selected.length} of {FILTER_LIMITS.authors} authors
      </p>

      <div className="space-y-1">
        <label htmlFor={`${id}-input`} className="text-sm font-medium">
          Author name
        </label>
        <div className="flex gap-2">
          <Input
            id={`${id}-input`}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setError(undefined)
            }}
            onKeyDown={(event) => {
              // Enter adds the name instead of submitting the whole form.
              if (event.key === 'Enter') {
                event.preventDefault()
                add(text)
              }
            }}
            autoComplete="off"
            placeholder="e.g. Jane Doe"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            className="h-11 min-w-0 bg-card"
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11"
            onClick={() => add(text)}
          >
            <Plus aria-hidden="true" />
            Add
          </Button>
        </div>
        <p id={errorId} aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      </div>

      <div
        role="group"
        aria-labelledby={`${id}-suggestions`}
        className="space-y-2"
      >
        <h3 id={`${id}-suggestions`} className="text-sm font-medium">
          Suggested from loaded articles
        </h3>
        {visible.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {visible.map(({ name }) => (
              <li key={authorKey(name)} className="max-w-full min-w-0">
                <button
                  type="button"
                  onClick={() => add(name)}
                  aria-label={`Add ${name}`}
                  className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border bg-background px-3 text-left text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:min-h-9"
                >
                  <Plus aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {suggestions.length
              ? 'No loaded authors match. You can still add the full name.'
              : 'Suggestions appear after articles have loaded in Explore or My Feed. You can always type a full name.'}
          </p>
        )}
      </div>
    </fieldset>
  )
}
