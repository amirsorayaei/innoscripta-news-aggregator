import { authorKey } from '../../shared/authors.js'
import { utcDayEnd, utcDayStart } from '../../shared/dates.js'
import {
  providerErrorMessages,
  type Article,
  type FeedErrorResponse,
  type FeedResponse,
  type ProviderErrorCode,
  type ProviderNote,
  type ProviderStatus,
} from '../../shared/feed.js'
import {
  feedFiltersToParams,
  type FeedFilters,
} from '../../shared/feed-filters.js'
import type { NewsMode } from '../../shared/health.js'
import { providerIds, type ProviderId } from '../../shared/providers.js'
import {
  ProviderError,
  ProviderLimitReached,
  type ProviderAdapter,
  type ProviderPage,
} from '../providers/types.js'
import {
  decodeCursor,
  encodeCursor,
  filtersFingerprint,
  InvalidCursorError,
  type FeedProgress,
  type ProviderProgress,
} from './cursor.js'
import { PageCache } from './page-cache.js'

export const PROVIDER_TIMEOUT_MS = 5000

export interface FeedServiceOptions {
  mode: NewsMode
  adapters: Record<ProviderId, ProviderAdapter>
  cache?: PageCache
  timeoutMs?: number
}

export type FeedResult =
  { status: 200; body: FeedResponse } | { status: 503; body: FeedErrorResponse }

type Outcome =
  | { kind: 'page'; page: ProviderPage }
  | { kind: 'limit'; note: ProviderNote }
  | { kind: 'error'; code: ProviderErrorCode }

export type FeedService = ReturnType<typeof createFeedService>

export function createFeedService({
  mode,
  adapters,
  cache = new PageCache(),
  timeoutMs = PROVIDER_TIMEOUT_MS,
}: FeedServiceOptions) {
  function initialProgress(filters: FeedFilters): FeedProgress {
    const entries = providerIds.map((id): [ProviderId, ProviderProgress] => {
      if (filters.sources.length && !filters.sources.includes(id)) {
        return [id, { s: 'skipped', note: 'not_selected' }]
      }
      const note = adapters[id].unavailableFor?.(filters)
      return [id, note ? { s: 'skipped', note } : { s: 'next', page: 1 }]
    })
    return Object.fromEntries(entries) as FeedProgress
  }

  async function fetchProviderPage(
    adapter: ProviderAdapter,
    filters: FeedFilters,
    page: number,
    signal: AbortSignal,
  ): Promise<Outcome> {
    // Only first pages are cached. Providers page by offset over a live,
    // newest-first list, so a later page cached before a fresher first page
    // could skip articles; a fresh later page can only repeat some, and those
    // are deduplicated. Authors are filtered after fetching, so they are not
    // part of the key.
    const query = feedFiltersToParams({ ...filters, authors: [] }).toString()
    const key = page === 1 ? `${mode}|${adapter.id}|${query}` : undefined
    const cached = key && cache.get(key)
    if (cached) return { kind: 'page', page: cached }

    const timeout = AbortSignal.timeout(timeoutMs)
    const combined = AbortSignal.any([signal, timeout])
    try {
      const result = await abortable(
        adapter.fetchPage(filters, page, combined),
        combined,
      )
      if (key) cache.set(key, result)
      return { kind: 'page', page: result }
    } catch (error) {
      if (signal.aborted) throw error
      if (error instanceof ProviderLimitReached) {
        return { kind: 'limit', note: error.note }
      }
      const code: ProviderErrorCode = timeout.aborted
        ? 'timeout'
        : error instanceof ProviderError
          ? error.code
          : 'upstream_unavailable'
      // Only the provider and a safe code are logged; never URLs or bodies.
      console.warn(`[feed] ${adapter.id} failed: ${code}`)
      return { kind: 'error', code }
    }
  }

  async function getFeed(
    filters: FeedFilters,
    cursor: string | undefined,
    signal: AbortSignal,
  ): Promise<FeedResult> {
    const fingerprint = filtersFingerprint(mode, filters)
    const allowed = initialProgress(filters)
    const progress = cursor ? decodeCursor(cursor, fingerprint) : allowed
    if (cursor) assertEligible(progress, allowed)

    const results = await Promise.all(
      providerIds.map(async (id) => {
        const current = progress[id]
        const outcome =
          current.s === 'next'
            ? await fetchProviderPage(
                adapters[id],
                filters,
                current.page,
                signal,
              )
            : undefined
        return { id, current, outcome }
      }),
    )

    const articles: Article[] = []
    const statuses: ProviderStatus[] = []
    const nextProgress = {} as FeedProgress

    for (const { id, current, outcome } of results) {
      const status = summarize(id, current, outcome, filters)
      articles.push(...status.articles)
      statuses.push(status.status)
      nextProgress[id] = status.next
    }

    const attempted = results.filter((r) => r.outcome)
    if (
      attempted.length &&
      attempted.every((r) => r.outcome?.kind === 'error')
    ) {
      return {
        status: 503,
        body: {
          error: {
            code: 'all_providers_failed',
            message: 'None of the news providers could be reached.',
          },
          providerStatuses: statuses,
        },
      }
    }

    const hasNext = providerIds.some((id) => nextProgress[id].s === 'next')
    return {
      status: 200,
      body: {
        mode,
        articles: articles.sort(newestFirst),
        providerStatuses: statuses,
        nextCursor: hasNext ? encodeCursor(fingerprint, nextProgress) : null,
      },
    }
  }

  return { getFeed }
}

function summarize(
  providerId: ProviderId,
  current: ProviderProgress,
  outcome: Outcome | undefined,
  filters: FeedFilters,
): { status: ProviderStatus; articles: Article[]; next: ProviderProgress } {
  const base = { providerId, rawCount: 0, matchedCount: 0, notes: [] }

  if (!outcome || current.s !== 'next') {
    const status: ProviderStatus =
      current.s === 'paused'
        ? { ...base, state: 'paused', error: errorFor(current.code) }
        : current.s === 'skipped'
          ? { ...base, state: 'skipped', notes: [current.note] }
          : {
              ...base,
              state: 'exhausted',
              notes:
                current.s === 'exhausted' && current.note ? [current.note] : [],
            }
    return { status, articles: [], next: current }
  }

  if (outcome.kind === 'error') {
    return {
      status: { ...base, state: 'paused', error: errorFor(outcome.code) },
      articles: [],
      next: { s: 'paused', code: outcome.code },
    }
  }

  if (outcome.kind === 'limit') {
    return {
      status: { ...base, state: 'exhausted', notes: [outcome.note] },
      articles: [],
      next: { s: 'exhausted', note: outcome.note },
    }
  }

  const { page } = outcome
  const matched = page.articles.filter((a) => matchesPostFilters(a, filters))
  return {
    status: {
      ...base,
      state: page.hasMore ? 'ok' : 'exhausted',
      rawCount: page.rawCount,
      matchedCount: matched.length,
      notes: page.notes,
    },
    articles: matched,
    next: page.hasMore
      ? { s: 'next', page: current.page + 1 }
      : { s: 'exhausted' },
  }
}

/**
 * Cursors are unsigned, so their progress must agree with what the current
 * filters allow: excluded or unavailable providers stay skipped, and eligible
 * ones cannot be marked skipped. Checked before any adapter is called.
 */
function assertEligible(progress: FeedProgress, allowed: FeedProgress) {
  for (const id of providerIds) {
    const expected = allowed[id]
    const actual = progress[id]
    const consistent =
      expected.s === 'skipped'
        ? actual.s === 'skipped' && actual.note === expected.note
        : actual.s !== 'skipped'
    if (!consistent) throw new InvalidCursorError()
  }
}

function errorFor(code: ProviderErrorCode) {
  return { code, message: providerErrorMessages[code] }
}

/** UTC day bounds and exact author matching, applied to every provider alike. */
export function matchesPostFilters(article: Article, filters: FeedFilters) {
  const published = Date.parse(article.publishedAt)
  if (filters.from && published < utcDayStart(filters.from)) return false
  if (filters.to && published > utcDayEnd(filters.to)) return false
  if (filters.authors.length) {
    const wanted = new Set(filters.authors.map(authorKey))
    return article.authors.some((name) => wanted.has(authorKey(name)))
  }
  return true
}

function newestFirst(a: Article, b: Article) {
  return b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)
}

/** Rejects as soon as the signal aborts, even if the adapter ignores it. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort)
    })
  })
}
