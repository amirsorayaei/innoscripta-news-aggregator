import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ArticleCard } from './ArticleCard'
import type { FeedArticle } from './merge-articles'

const GRID = 'grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3'

export function ArticleGrid({ articles }: { articles: FeedArticle[] }) {
  // One reference time per mount keeps relative times consistent across cards.
  const [now] = useState(Date.now)

  return (
    // Native scroll anchoring is off; useScrollAnchor restores position itself.
    <ul className={`${GRID} [overflow-anchor:none]`}>
      {articles.map((article) => (
        <li key={article.id} data-article-id={article.id}>
          <ArticleCard article={article} now={now} />
        </li>
      ))}
    </ul>
  )
}

export function ArticleGridSkeleton({ label }: { label: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <ul aria-hidden="true" className={GRID}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-xl border bg-card">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
