const DAY_MS = 24 * 60 * 60 * 1000
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** True for a real calendar day in `YYYY-MM-DD` form (rejects 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE.exec(value)
  if (!match) return false
  const [, year, month, day] = match.map(Number) as [
    number,
    number,
    number,
    number,
  ]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** First millisecond of a `YYYY-MM-DD` day in UTC. */
export function utcDayStart(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`)
}

/** Last millisecond of a `YYYY-MM-DD` day in UTC. */
export function utcDayEnd(date: string): number {
  return utcDayStart(date) + DAY_MS - 1
}

/** `YYYY-MM-DD` for a timestamp, in UTC. */
export function toUtcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}
