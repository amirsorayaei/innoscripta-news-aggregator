import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToggleChipProps {
  pressed: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}

/** A pill-shaped toggle button (`aria-pressed`) used for multi-select filters. */
export function ToggleChip({
  pressed,
  onClick,
  className,
  children,
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border bg-background px-3 text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground',
        className,
      )}
    >
      {pressed && <Check aria-hidden="true" className="size-3.5" />}
      {children}
    </button>
  )
}
