export function PlaceholderPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
      {children}
    </div>
  )
}
