import { useState, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import type { FeedFilters } from '@shared/feed-filters'
import type { NewsMode } from '@shared/health'
import { Button } from '@/components/ui/button'
import { ArticleGrid, ArticleGridSkeleton } from './ArticleGrid'
import { FeedErrorPanel } from './FeedErrorPanel'
import { FeedFooter } from './FeedFooter'
import { FeedNotices } from './FeedNotices'
import { describeFeedError } from './feed-messages'
import { feedQueryKey, useFeed } from './use-feed'
import { useFeedMode } from './use-feed-mode'
import { ScrollAnchor } from './ScrollAnchor'

interface ArticleFeedProps {
  filters: FeedFilters
  /** Shown with the empty state, e.g. a way to clear filters. */
  emptyAction?: ReactNode
  /** Wording for the empty state; defaults suit ad-hoc searches. */
  emptyTitle?: string
  emptyHint?: string
}

/** Paginated, merged article feed for a set of applied filters. */
export function ArticleFeed(props: ArticleFeedProps) {
  const feedMode = useFeedMode()

  if (feedMode.state === 'loading') {
    return <ArticleGridSkeleton label="Loading articles…" />
  }
  if (feedMode.state === 'error') {
    return (
      <FeedErrorPanel
        title="Couldn’t reach the News Desk server."
        details={['Articles can’t be loaded until the server responds.']}
        onRetry={feedMode.retry}
      />
    )
  }
  if (feedMode.state === 'unconfigured') {
    return (
      <FeedErrorPanel
        title="Live news isn’t configured on this server."
        details={['The server is missing provider API keys.']}
      />
    )
  }
  return <FeedResults {...props} mode={feedMode.mode} />
}

interface FeedResultsProps extends ArticleFeedProps {
  mode: NewsMode
}

function FeedResults({
  filters,
  mode,
  emptyAction,
  emptyTitle = 'No articles match these filters.',
  emptyHint = 'Try a broader search, other categories or a wider date range.',
}: FeedResultsProps) {
  const { query, articles, summary, loadMore, refresh } = useFeed(filters, mode)
  const key = feedQueryKey(mode, filters).join('|')
  const [firstKey] = useState(key)

  if (query.isPending) {
    const updating = key !== firstKey
    return (
      <ArticleGridSkeleton
        label={updating ? 'Updating results…' : 'Loading articles…'}
      />
    )
  }

  if (query.isError && !summary) {
    const { title, details, recovery } = describeFeedError(query.error)
    return (
      <FeedErrorPanel
        title={title}
        details={details}
        onRetry={recovery === 'none' ? undefined : refresh}
      />
    )
  }
  if (!summary) return null

  const count = articles.length
  const status = query.isFetchingNextPage
    ? `Showing ${count} ${count === 1 ? 'article' : 'articles'}, loading more…`
    : `Showing ${count} ${count === 1 ? 'article' : 'articles'}`

  return (
    <section aria-labelledby="results-heading" className="space-y-4">
      <h2 id="results-heading" className="sr-only">
        Results
      </h2>
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
        <Button
          variant="ghost"
          size="lg"
          className="min-h-11"
          onClick={refresh}
          disabled={query.isFetching}
        >
          <RotateCw aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <FeedNotices summary={summary} />

      {count === 0 && !summary.hasMore ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card p-6">
          <h3 className="font-semibold">{emptyTitle}</h3>
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
          {emptyAction}
        </div>
      ) : (
        <ScrollAnchor
          items={articles}
          armed={query.isFetchingNextPage}
          stream={key}
        >
          <ArticleGrid articles={articles} />
        </ScrollAnchor>
      )}

      {(count > 0 || summary.hasMore) && (
        <FeedFooter
          summary={summary}
          isLoadingMore={query.isFetchingNextPage}
          loadMoreError={query.isFetchNextPageError ? query.error : undefined}
          onLoadMore={loadMore}
          onRefresh={refresh}
        />
      )}
    </section>
  )
}
