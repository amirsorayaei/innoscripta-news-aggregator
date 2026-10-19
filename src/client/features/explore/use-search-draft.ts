import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { normalizeQuery } from './explore-url'

export const SEARCH_DEBOUNCE_MS = 400

/**
 * Text typed into the search box, committed after a pause or immediately on
 * submit. A newer applied keyword (Back/Forward, a removed chip) replaces the
 * draft and cancels any pending commit.
 */
export function useSearchDraft(applied: string, commit: (q: string) => void) {
  const [draft, setDraft] = useState(applied)
  const [syncedApplied, setSyncedApplied] = useState(applied)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latestCommit = useRef(commit)

  useLayoutEffect(() => {
    latestCommit.current = commit
  })

  // Adjust state during render when the applied keyword changes elsewhere.
  if (applied !== syncedApplied) {
    setSyncedApplied(applied)
    if (normalizeQuery(draft) !== applied) setDraft(applied)
  }

  const cancel = useCallback(() => clearTimeout(timer.current), [])
  useEffect(() => cancel, [applied, cancel])

  const change = useCallback(
    (value: string) => {
      setDraft(value)
      cancel()
      timer.current = setTimeout(
        () => latestCommit.current(normalizeQuery(value)),
        SEARCH_DEBOUNCE_MS,
      )
    },
    [cancel],
  )

  const submit = useCallback(
    (value: string) => {
      cancel()
      latestCommit.current(normalizeQuery(value))
    },
    [cancel],
  )

  return { draft, change, submit }
}
