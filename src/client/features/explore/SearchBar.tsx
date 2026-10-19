import { Search, X } from 'lucide-react'
import { FILTER_LIMITS } from '@shared/feed-filters'
import { Input } from '@/components/ui/input'
import { useSearchDraft } from './use-search-draft'

interface SearchBarProps {
  applied: string
  onCommit: (q: string) => void
}

export function SearchBar({ applied, onCommit }: SearchBarProps) {
  const { draft, change, submit } = useSearchDraft(applied, onCommit)

  return (
    <form
      role="search"
      className="relative min-w-0 flex-1"
      onSubmit={(event) => {
        event.preventDefault()
        submit(draft)
      }}
    >
      <label htmlFor="explore-search" className="sr-only">
        Search articles
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id="explore-search"
        type="search"
        value={draft}
        onChange={(event) => change(event.target.value)}
        maxLength={FILTER_LIMITS.queryLength}
        placeholder="Search articles"
        autoComplete="off"
        className="h-11 bg-card pr-11 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            change('')
            submit('')
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </form>
  )
}
