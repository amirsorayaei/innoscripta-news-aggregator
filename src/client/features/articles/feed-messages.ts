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
  /** False when retrying cannot help, e.g. missing server configuration. */
  retryable: boolean
}

export function describeFeedError(error: unknown): FeedErrorDescription {
  if (!(error instanceof ApiError)) {
    return {
      title: 'Couldn’t reach the News Desk server.',
      details: ['Check your connection and try again.'],
      retryable: true,
    }
  }

  if (error.code === 'configuration_error') {
    return {
      title: 'Live news isn’t configured on this server.',
      details: ['The server is missing provider API keys.'],
      retryable: false,
    }
  }

  if (error.code === 'all_providers_failed') {
    const statuses =
      feedErrorResponseSchema.safeParse(error.body).data?.providerStatuses ?? []
    const paused = statuses.filter((s) => s.state === 'paused')
    return {
      title: 'None of the news sources could be reached.',
      details: paused.map(pausedMessage),
      retryable: true,
    }
  }

  if (error.code === 'invalid_cursor') {
    return {
      title: 'These results are out of date.',
      details: ['Refresh to start again with the current filters.'],
      retryable: true,
    }
  }

  return { title: error.message, details: [], retryable: error.status >= 500 }
}
