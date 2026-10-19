import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  providerErrorCodeSchema,
  providerNoteSchema,
} from '../../shared/feed.js'
import {
  feedFiltersToParams,
  type FeedFilters,
} from '../../shared/feed-filters.js'
import type { NewsMode } from '../../shared/health.js'
import type { ProviderId } from '../../shared/providers.js'
import { MAX_PAGE } from '../providers/types.js'

const CURSOR_VERSION = 1
const MAX_CURSOR_LENGTH = 1024

const progressSchema = z.discriminatedUnion('s', [
  z.object({
    s: z.literal('next'),
    page: z.number().int().min(1).max(MAX_PAGE),
  }),
  z.object({ s: z.literal('exhausted'), note: providerNoteSchema.optional() }),
  z.object({ s: z.literal('paused'), code: providerErrorCodeSchema }),
  z.object({ s: z.literal('skipped'), note: providerNoteSchema }),
])
export type ProviderProgress = z.infer<typeof progressSchema>

const cursorSchema = z.object({
  v: z.literal(CURSOR_VERSION),
  f: z.string(),
  p: z
    .object({
      guardian: progressSchema,
      nyt: progressSchema,
      newsapi: progressSchema,
    })
    .strict(),
})
export type FeedProgress = Record<ProviderId, ProviderProgress>

export class InvalidCursorError extends Error {
  constructor() {
    super('The pagination cursor is invalid or does not match the filters.')
    this.name = 'InvalidCursorError'
  }
}

/**
 * Binds a cursor to the mode and normalized filters. It is not a secret or an
 * authorization token; it only prevents reusing a cursor with other filters.
 */
export function filtersFingerprint(mode: NewsMode, filters: FeedFilters) {
  return createHash('sha256')
    .update(`${mode}?${feedFiltersToParams(filters).toString()}`)
    .digest('base64url')
    .slice(0, 16)
}

export function encodeCursor(fingerprint: string, progress: FeedProgress) {
  const payload = { v: CURSOR_VERSION, f: fingerprint, p: progress }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeCursor(cursor: string, fingerprint: string) {
  if (cursor.length > MAX_CURSOR_LENGTH || !/^[\w-]+$/.test(cursor)) {
    throw new InvalidCursorError()
  }
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    throw new InvalidCursorError()
  }
  const parsed = cursorSchema.safeParse(payload)
  if (!parsed.success || parsed.data.f !== fingerprint) {
    throw new InvalidCursorError()
  }
  return parsed.data.p
}
