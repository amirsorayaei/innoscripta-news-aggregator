const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const calendar = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const exact = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

/** Short publication time: relative within a week, otherwise a UTC date. */
export function formatPublished(iso: string, now: number) {
  const published = Date.parse(iso)
  const age = now - published
  if (age < MINUTE) return 'Just now'
  if (age < HOUR) return relative.format(-Math.floor(age / MINUTE), 'minute')
  if (age < DAY) return relative.format(-Math.floor(age / HOUR), 'hour')
  if (age < 7 * DAY) return relative.format(-Math.floor(age / DAY), 'day')
  return calendar.format(published)
}

export function formatExactUtc(iso: string) {
  return `${exact.format(Date.parse(iso))} UTC`
}
