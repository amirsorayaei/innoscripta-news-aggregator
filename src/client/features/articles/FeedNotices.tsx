import { AlertTriangle, Info } from 'lucide-react'
import { noteMessage, pausedMessage } from './feed-messages'
import type { FeedSummary } from './feed-state'

/** Paused providers and provider notes, shown above results that are still usable. */
export function FeedNotices({ summary }: { summary: FeedSummary }) {
  const notes = summary.notes
    .map(({ providerId, note }) => noteMessage(providerId, note))
    .filter((message): message is string => Boolean(message))

  return (
    <>
      {summary.paused.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-warning-foreground/20 bg-warning p-3 text-sm text-warning-foreground">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <div>
            <h2 className="font-medium">Some sources are unavailable</h2>
            <ul className="mt-1 space-y-0.5">
              {summary.paused.map((status) => (
                <li key={status.providerId}>{pausedMessage(status)}</li>
              ))}
            </ul>
            <p className="mt-1">
              Articles from the other sources are still shown.
            </p>
          </div>
        </div>
      )}
      {notes.length > 0 && (
        <div className="flex gap-3 rounded-lg border bg-muted/60 p-3 text-sm text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div>
            <h2 className="font-medium text-foreground">About these results</h2>
            <ul className="mt-1 space-y-0.5">
              {notes.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
