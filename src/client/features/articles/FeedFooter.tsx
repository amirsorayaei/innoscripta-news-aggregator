import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Loader2 } from 'lucide-react'
import { providerNames } from '@shared/providers'
import { Button } from '@/components/ui/button'
import { describeFeedError } from './feed-messages'
import { feedEnd, type FeedSummary } from './feed-state'

interface FeedFooterProps {
  summary: FeedSummary
  isLoadingMore: boolean
  loadMoreError: unknown
  onLoadMore: () => void
  onRefresh: () => void
}

export function FeedFooter({
  summary,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  onRefresh,
}: FeedFooterProps) {
  const end = feedEnd(summary)
  const box = useRef<HTMLDivElement>(null)
  const focused = useRef<Element | null>(null)

  // When the focused button is removed or replaced (the end of results, an
  // error state), keep keyboard focus in the footer instead of the page body.
  // Focus only moves if that element really left the page.
  useEffect(() => {
    const last = focused.current
    if (!last || last.isConnected || document.activeElement !== document.body)
      return
    focused.current = null
    const target = box.current?.querySelector('button') ?? box.current
    // The reading position is kept by ScrollAnchor; focus must not scroll.
    target?.focus({ preventScroll: true })
  })

  const trackFocus = (element: Element | null) => {
    focused.current = element
  }

  const refreshButton = (
    <Button
      key="refresh"
      size="lg"
      variant="outline"
      className="min-h-11"
      onClick={onRefresh}
    >
      Refresh
    </Button>
  )
  const loadMoreButton = (
    <Button
      key="load-more"
      size="lg"
      variant="outline"
      className="min-h-11 min-w-40 aria-disabled:cursor-progress"
      // aria-disabled, not disabled: browsers move focus off a disabled button,
      // which would drop keyboard users to the top of the page.
      onClick={isLoadingMore ? undefined : onLoadMore}
      aria-disabled={isLoadingMore || undefined}
      aria-busy={isLoadingMore}
    >
      {isLoadingMore && <Loader2 aria-hidden="true" className="animate-spin" />}
      {isLoadingMore ? 'Loading more…' : 'Load more'}
    </Button>
  )

  if (loadMoreError && !isLoadingMore) {
    const { title, details, recovery } = describeFeedError(loadMoreError)
    return (
      <FooterBox box={box} onFocusChange={trackFocus}>
        <div role="alert" className="text-sm">
          <p className="font-medium">Couldn’t load more articles. {title}</p>
          {details.map((detail) => (
            <p key={detail} className="text-muted-foreground">
              {detail}
            </p>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Articles already shown stay available.
        </p>
        {/* A rejected cursor cannot be retried; transient failures retry the same cursor. */}
        {recovery === 'refresh' && refreshButton}
        {recovery === 'retry' && loadMoreButton}
      </FooterBox>
    )
  }

  if (end === 'more' || end === 'sparse') {
    return (
      <FooterBox box={box} onFocusChange={trackFocus}>
        {end === 'sparse' && (
          <p className="text-sm text-muted-foreground">
            The last batch had no new articles matching these filters. More may
            follow.
          </p>
        )}
        {loadMoreButton}
      </FooterBox>
    )
  }

  if (end === 'stopped') {
    const names = summary.paused
      .map((s) => providerNames[s.providerId])
      .join(', ')
    return (
      <FooterBox box={box} onFocusChange={trackFocus}>
        <p className="text-sm text-muted-foreground">
          No more articles from the available sources. {names} paused during
          this search; refresh to try again.
        </p>
        {refreshButton}
      </FooterBox>
    )
  }

  return (
    <FooterBox box={box} onFocusChange={trackFocus}>
      <p className="text-sm text-muted-foreground">
        You’ve reached the end of these results.
      </p>
    </FooterBox>
  )
}

interface FooterBoxProps {
  box: RefObject<HTMLDivElement | null>
  onFocusChange: (element: Element | null) => void
  children: ReactNode
}

function FooterBox({ box, onFocusChange, children }: FooterBoxProps) {
  return (
    <div
      ref={box}
      tabIndex={-1}
      onFocus={(event) => onFocusChange(event.target)}
      onBlur={(event) => {
        // A null target can mean the focused element was removed; keep it.
        if (event.relatedTarget) onFocusChange(null)
      }}
      className="flex flex-col items-center gap-3 py-8 text-center outline-none"
    >
      {children}
    </div>
  )
}
