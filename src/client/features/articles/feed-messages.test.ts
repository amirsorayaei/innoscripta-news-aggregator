import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { status } from '@/test/articles'
import { describeFeedError, noteMessage } from './feed-messages'

describe('describeFeedError', () => {
  it('lists each provider failure when all providers fail', () => {
    const body = {
      error: { code: 'all_providers_failed', message: 'x' },
      providerStatuses: [
        status('guardian', {
          state: 'paused',
          error: { code: 'rate_limited', message: 'Rate limit reached.' },
        }),
        status('nyt', { state: 'skipped', notes: ['not_selected'] }),
      ],
    }
    const description = describeFeedError(
      new ApiError(503, 'all_providers_failed', 'x', body),
    )
    expect(description.details).toEqual(['The Guardian: Rate limit reached.'])
    expect(description.recovery).toBe('retry')
  })

  it('asks for a refresh when the cursor is rejected', () => {
    const description = describeFeedError(
      new ApiError(400, 'invalid_cursor', 'Cursor rejected.'),
    )
    expect(description.recovery).toBe('refresh')
  })

  it('does not offer a retry for missing configuration', () => {
    const description = describeFeedError(
      new ApiError(503, 'configuration_error', 'Missing keys'),
    )
    expect(description.recovery).toBe('none')
  })

  it('treats network failures as retryable', () => {
    expect(describeFeedError(new TypeError('fetch failed')).recovery).toBe(
      'retry',
    )
  })
})

describe('noteMessage', () => {
  it('explains publisher-based categories in plain language', () => {
    expect(noteMessage('newsapi', 'publisher_categories')).toBe(
      'NewsAPI categories describe the publisher, not each article.',
    )
    expect(noteMessage('guardian', 'not_selected')).toBeUndefined()
  })
})
