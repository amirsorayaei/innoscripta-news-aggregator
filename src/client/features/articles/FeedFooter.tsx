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
  const refreshButton = (
    <Button
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
      size="lg"
      variant="outline"
      className="min-h-11 min-w-40"
      onClick={onLoadMore}
      disabled={isLoadingMore}
      aria-busy={isLoadingMore}
    >
      {isLoadingMore && <Loader2 aria-hidden="true" className="animate-spin" />}
      {isLoadingMore ? 'Loading more…' : 'Load more'}
    </Button>
  )

  if (loadMoreError && !isLoadingMore) {
    const { title, details, recovery } = describeFeedError(loadMoreError)
    return (
      <FooterBox>
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
      <FooterBox>
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
      <FooterBox>
        <p className="text-sm text-muted-foreground">
          No more articles from the available sources. {names} paused during
          this search; refresh to try again.
        </p>
        {refreshButton}
      </FooterBox>
    )
  }

  return (
    <FooterBox>
      <p className="text-sm text-muted-foreground">
        You’ve reached the end of these results.
      </p>
    </FooterBox>
  )
}

function FooterBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      {children}
    </div>
  )
}
