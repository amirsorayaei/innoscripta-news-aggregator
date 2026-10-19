import { describe, expect, it } from 'vitest'
import { formatExactUtc, formatPublished } from './format-published'

const NOW = Date.parse('2026-10-19T12:00:00Z')

describe('formatPublished', () => {
  it.each([
    ['2026-10-19T11:59:30Z', 'Just now'],
    ['2026-10-19T11:15:00Z', '45 minutes ago'],
    ['2026-10-19T07:00:00Z', '5 hours ago'],
    ['2026-10-18T09:00:00Z', 'yesterday'],
    ['2026-10-15T12:00:00Z', '4 days ago'],
    ['2026-10-01T12:00:00Z', '1 Oct 2026'],
    ['2026-10-19T12:05:00Z', 'Just now'],
  ])('formats %s as %s', (iso, expected) => {
    expect(formatPublished(iso, NOW)).toBe(expected)
  })

  it('gives an exact UTC time for tooltips', () => {
    expect(formatExactUtc('2026-10-19T08:30:00Z')).toBe(
      '19 Oct 2026, 08:30 UTC',
    )
  })
})
