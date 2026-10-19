import type {
  Article,
  ProviderErrorCode,
  ProviderNote,
} from '../../shared/feed.js'
import type { FeedFilters } from '../../shared/feed-filters.js'
import type { ProviderId } from '../../shared/providers.js'

export const PAGE_SIZE = 10

export interface ProviderPage {
  articles: Article[]
  /** Items in the upstream page before validation and post-filters. */
  rawCount: number
  hasMore: boolean
  notes: ProviderNote[]
}

export interface ProviderAdapter {
  id: ProviderId
  /** Highest page the provider can serve; pages start at 1. */
  maxPage: number
  /** A note when the provider cannot serve these filters at all. */
  unavailableFor?(filters: FeedFilters): ProviderNote | undefined
  fetchPage(
    filters: FeedFilters,
    page: number,
    signal: AbortSignal,
  ): Promise<ProviderPage>
}

/** A provider failure with a safe code; upstream text and URLs are never kept. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode

  constructor(code: ProviderErrorCode) {
    super(`Provider request failed: ${code}`)
    this.name = 'ProviderError'
    this.code = code
  }
}

/** Thrown when an upstream response signals the last reachable page. */
export class ProviderLimitReached extends Error {
  readonly note: ProviderNote

  constructor(note: ProviderNote) {
    super(`Provider limit reached: ${note}`)
    this.name = 'ProviderLimitReached'
    this.note = note
  }
}

/** Upper bound for provider pages carried in cursors. */
export const MAX_PAGE = 100

/** Parses each item on its own so one malformed item cannot fail the page. */
export function parseItems<T>(
  items: unknown[],
  parse: (item: unknown) => T | undefined,
): T[] {
  return items.flatMap((item) => {
    const result = parse(item)
    return result ? [result] : []
  })
}
