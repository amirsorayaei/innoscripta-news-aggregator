import {
  feedErrorResponseSchema,
  type ProviderNote,
  type ProviderStatus,
} from '@shared/feed'
import { providerNames, type ProviderId } from '@shared/providers'
import { ApiError } from '@/lib/api-client'

export function noteMessage(providerId: ProviderId, note: ProviderNote) {
  const name = providerNames[providerId]
  switch (note) {
    case 'publisher_categories':
      return `${name} categories describe the publisher, not each article.`
    case 'date_range_clamped':
      return `${name} only searches about the last month, so earlier dates were left out.`
    case 'date_out_of_range':
      return `${name} can't search these dates; its free plan covers about the last month.`
    case 'result_limit_reached':
      return `${name} reached its free-plan result limit, so it has no further pages.`
    case 'not_selected':
      return undefined
  }
}

/** "Provider: reason" for a paused provider, using the server's safe message. */
export function pausedMessage(status: ProviderStatus) {
  const reason = status.error?.message ?? 'It is temporarily unavailable.'
  return `${providerNames[status.providerId]}: ${reason}`
}

export interface FeedErrorDescription {
  title: string
  details: string[]
  /**
   * `retry`: repeat the same request (a failed page keeps its cursor).
   * `refresh`: start over from page one; the cursor itself was rejected.
   * `none`: retrying cannot help, e.g. missing server configuration.
   */
  recovery: 'retry' | 'refresh' | 'none'
}

export function describeFeedError(error: unknown): FeedErrorDescription {
  if (!(error instanceof ApiError)) {
    return {
      title: 'Couldn’t reach the News Aggregator server.',
      details: ['Check your connection and try again.'],
      recovery: 'retry',
    }
  }

  if (error.code === 'configuration_error') {
    return {
      title: 'Live news isn’t configured on this server.',
      details: ['The server is missing provider API keys.'],
      recovery: 'none',
    }
  }

  if (error.code === 'all_providers_failed') {
    const statuses =
      feedErrorResponseSchema.safeParse(error.body).data?.providerStatuses ?? []
    const paused = statuses.filter((s) => s.state === 'paused')
    return {
      title: 'None of the news sources could be reached.',
      details: paused.map(pausedMessage),
      recovery: 'retry',
    }
  }

  if (error.code === 'invalid_cursor') {
    return {
      title: 'These results are out of date.',
      details: ['Refresh to start again with the current filters.'],
      recovery: 'refresh',
    }
  }

  return {
    title: error.message,
    details: [],
    recovery: error.status >= 500 ? 'retry' : 'none',
  }
}
