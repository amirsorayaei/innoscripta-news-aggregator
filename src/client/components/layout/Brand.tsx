import { Link } from 'react-router'

export function Brand() {
  return (
    <Link
      to="/explore"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg text-base font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
      >
        NA
      </span>
      News Aggregator
    </Link>
  )
}
