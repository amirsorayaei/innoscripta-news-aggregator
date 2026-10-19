import { describe, expect, it } from 'vitest'
import { isCalendarDate, utcDayEnd, utcDayStart } from './dates.js'

describe('dates', () => {
  it('accepts only real calendar days', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-04-31')).toBe(false)
    expect(isCalendarDate('2026-4-1')).toBe(false)
  })

  it('covers the whole UTC day inclusively', () => {
    expect(new Date(utcDayStart('2026-10-19')).toISOString()).toBe(
      '2026-10-19T00:00:00.000Z',
    )
    expect(new Date(utcDayEnd('2026-10-19')).toISOString()).toBe(
      '2026-10-19T23:59:59.999Z',
    )
  })
})
