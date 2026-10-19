import { z } from 'zod'
import { categorySchema } from './categories.js'
import { newsModeSchema } from './health.js'
import { providerIdSchema } from './providers.js'

export const articleSchema = z.object({
  /** Stable hash of `canonicalUrl`; equal URLs from any provider share an ID. */
  id: z.string(),
  canonicalUrl: z.url(),
  url: z.url(),
  title: z.string().min(1),
  summary: z.string().optional(),
  imageUrl: z.url().optional(),
  publishedAt: z.iso.datetime(),
  authors: z.array(z.string()),
  providerId: providerIdSchema,
  publisherName: z.string(),
  category: categorySchema.optional(),
  /** `publisher`: inferred from the publisher, not the article's own topic. */
  categoryBasis: z.enum(['article', 'publisher', 'unknown']),
})
export type Article = z.infer<typeof articleSchema>

export const providerErrorCodes = [
  'unauthorized',
  'rate_limited',
  'timeout',
  'upstream_unavailable',
  'invalid_response',
  'bad_request',
] as const
export const providerErrorCodeSchema = z.enum(providerErrorCodes)
export type ProviderErrorCode = z.infer<typeof providerErrorCodeSchema>

export const providerErrorMessages: Record<ProviderErrorCode, string> = {
  unauthorized: 'The provider rejected the API key.',
  rate_limited: 'The provider rate limit was reached. Try again later.',
  timeout: 'The provider did not respond in time.',
  upstream_unavailable: 'The provider could not be reached.',
  invalid_response: 'The provider sent an unexpected response.',
  bad_request: 'The provider could not handle this search.',
}

export const providerNoteCodes = [
  /** Provider excluded by the source filter. */
  'not_selected',
  /** The requested dates are outside what the provider plan can search. */
  'date_out_of_range',
  /** The start date was moved forward to the provider's oldest searchable day. */
  'date_range_clamped',
  /** The provider plan's result limit ended paging, not the end of the archive. */
  'result_limit_reached',
  /** Categories were matched through publishers, not article topics. */
  'publisher_categories',
] as const
export const providerNoteSchema = z.enum(providerNoteCodes)
export type ProviderNote = z.infer<typeof providerNoteSchema>

export const providerStateSchema = z.enum([
  'ok',
  'exhausted',
  'paused',
  'skipped',
])
export type ProviderState = z.infer<typeof providerStateSchema>

export const providerStatusSchema = z.object({
  providerId: providerIdSchema,
  state: providerStateSchema,
  /** Items the provider returned in this batch, before validation and filters. */
  rawCount: z.number().int().min(0),
  /** Articles from this batch included in the response. */
  matchedCount: z.number().int().min(0),
  error: z
    .object({ code: providerErrorCodeSchema, message: z.string() })
    .optional(),
  notes: z.array(providerNoteSchema),
})
export type ProviderStatus = z.infer<typeof providerStatusSchema>

export const feedResponseSchema = z.object({
  mode: newsModeSchema,
  articles: z.array(articleSchema),
  providerStatuses: z.array(providerStatusSchema),
  /** Opaque; send back unchanged with the same filters. Null when nothing is left. */
  nextCursor: z.string().nullable(),
})
export type FeedResponse = z.infer<typeof feedResponseSchema>

export const feedErrorCodes = [
  'invalid_request',
  'invalid_cursor',
  'configuration_error',
  'all_providers_failed',
] as const
export type FeedErrorCode = (typeof feedErrorCodes)[number]

export const feedErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.array(z.string()).optional(),
  }),
  providerStatuses: z.array(providerStatusSchema).optional(),
})
export type FeedErrorResponse = z.infer<typeof feedErrorResponseSchema>
