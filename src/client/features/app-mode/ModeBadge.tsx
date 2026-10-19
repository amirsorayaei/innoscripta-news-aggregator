import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAppMode } from './useAppMode'

export function ModeBadge({ className }: { className?: string }) {
  const { data, isPending, isError } = useAppMode()

  if (isPending) return null

  if (isError) {
    return (
      <Badge variant="outline" className={cn('text-destructive', className)}>
        Server unreachable
      </Badge>
    )
  }

  if (data.mode === 'demo') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'border-warning-foreground/30 bg-warning text-warning-foreground',
          className,
        )}
        title="Articles are generated sample data, not real news."
      >
        Demo data
      </Badge>
    )
  }

  return data.ready ? (
    <Badge variant="secondary" className={className}>
      Live
    </Badge>
  ) : (
    <Badge variant="outline" className={cn('text-destructive', className)}>
      Live · keys missing
    </Badge>
  )
}
