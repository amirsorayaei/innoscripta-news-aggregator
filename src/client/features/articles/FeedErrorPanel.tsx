import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FeedErrorPanelProps {
  title: string
  details?: string[]
  onRetry?: () => void
}

export function FeedErrorPanel({
  title,
  details = [],
  onRetry,
}: FeedErrorPanelProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/25 bg-card p-6"
    >
      <div className="flex gap-3">
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-destructive"
        />
        <div>
          <h2 className="font-semibold">{title}</h2>
          {details.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {onRetry && (
        <Button
          size="lg"
          variant="outline"
          className="min-h-11"
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  )
}
