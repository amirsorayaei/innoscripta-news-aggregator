import type { FeedResponse, ProviderNote, ProviderStatus } from '@shared/feed'
import type { ProviderId } from '@shared/providers'

export interface FeedSummary {
  /** Provider statuses from the most recent batch. */
  statuses: ProviderStatus[]
  /** Providers paused in this pagination stream; the server will not retry them. */
  paused: ProviderStatus[]
  /** Explanatory notes from any batch, without duplicates. */
  notes: { providerId: ProviderId; note: ProviderNote }[]
  hasMore: boolean
  /** The latest batch added no articles although more may follow. */
  sparse: boolean
}

export type FeedEnd = 'more' | 'sparse' | 'end' | 'stopped'

export function summarizeFeed(pages: FeedResponse[]): FeedSummary {
  const latest = pages.at(-1)
  const statuses = latest?.providerStatuses ?? []
  const hasMore = Boolean(latest?.nextCursor)

  const seen = new Set<string>()
  const notes: FeedSummary['notes'] = []
  for (const page of pages) {
    for (const { providerId, notes: codes } of page.providerStatuses) {
      for (const note of codes) {
        const key = `${providerId}:${note}`
        if (note === 'not_selected' || seen.has(key)) continue
        seen.add(key)
        notes.push({ providerId, note })
      }
    }
  }

  return {
    statuses,
    paused: statuses.filter((s) => s.state === 'paused'),
    notes,
    hasMore,
    sparse: hasMore && latest?.articles.length === 0,
  }
}

/** Where the stream stands: more to load, sparse batch, finished, or stopped by paused providers. */
export function feedEnd(summary: FeedSummary): FeedEnd {
  if (summary.hasMore) return summary.sparse ? 'sparse' : 'more'
  return summary.paused.length ? 'stopped' : 'end'
}
