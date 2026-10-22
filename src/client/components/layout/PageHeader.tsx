interface PageHeaderProps {
  title: string
  description: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="mb-6 max-w-2xl">
      <title>{`${title} · News Aggregator`}</title>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </header>
  )
}
