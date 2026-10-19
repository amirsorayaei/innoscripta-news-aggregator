import { categoryLabels } from '@shared/categories'
import { providerNames } from '@shared/providers'
import { ArticleImage } from './ArticleImage'
import { formatExactUtc, formatPublished } from './format-published'
import type { FeedArticle } from './merge-articles'

const shortProviderNames = {
  guardian: 'Guardian',
  nyt: 'NYT',
  newsapi: 'NewsAPI',
} as const

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url)

interface ArticleCardProps {
  article: FeedArticle
  now: number
}

export function ArticleCard({ article, now }: ArticleCardProps) {
  const {
    url,
    title,
    summary,
    imageUrl,
    authors,
    publisherName,
    providerId,
    providers,
    publishedAt,
  } = article
  // Name the providers only when the publisher alone does not say where it came from.
  const showProviders =
    providers.length > 1 || publisherName !== providerNames[providerId]

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-colors hover:border-primary/30">
      <ArticleImage src={imageUrl} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80 [overflow-wrap:anywhere]">
            {publisherName}
          </span>
          {showProviders && (
            <span>
              via {providers.map((p) => shortProviderNames[p]).join(', ')}
            </span>
          )}
          <CategoryTag article={article} />
        </div>

        <h3 className="line-clamp-4 text-base leading-snug font-semibold [overflow-wrap:anywhere]">
          {isHttpUrl(url) ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm underline-offset-2 hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            title
          )}
        </h3>

        {summary && (
          <p className="line-clamp-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {summary}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-0.5 pt-2 text-xs text-muted-foreground">
          {authors.length > 0 && (
            <p className="line-clamp-1 [overflow-wrap:anywhere]">
              By {authors.join(', ')}
            </p>
          )}
          <time dateTime={publishedAt} title={formatExactUtc(publishedAt)}>
            {formatPublished(publishedAt, now)}
          </time>
        </div>
      </div>
    </article>
  )
}

function CategoryTag({ article }: { article: FeedArticle }) {
  if (!article.category) return null
  const label = categoryLabels[article.category]
  const byPublisher = article.categoryBasis === 'publisher'

  return (
    <span
      className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground"
      title={
        byPublisher
          ? 'Category of the publisher, not this specific article'
          : undefined
      }
    >
      {label}
      {byPublisher && (
        <span className="text-muted-foreground"> · publisher</span>
      )}
    </span>
  )
}
