import { useMemo } from 'react'
import { Link } from 'react-router'
import { SlidersHorizontal } from 'lucide-react'
import { categoryLabels } from '@shared/categories'
import { providerNames } from '@shared/providers'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { ArticleFeed } from '@/features/articles/ArticleFeed'
import {
  isEmptyPreferences,
  preferencesToFilters,
  type Preferences,
} from '@/features/preferences/preferences'
import { usePreferences } from '@/features/preferences/preferences-context'

const editLink = (
  <Button asChild variant="outline" size="lg" className="min-h-11">
    <Link to="/preferences">
      <SlidersHorizontal aria-hidden="true" />
      Edit preferences
    </Link>
  </Button>
)

export function MyFeedPage() {
  const { applied } = usePreferences()
  const filters = useMemo(() => preferencesToFilters(applied), [applied])
  const empty = isEmptyPreferences(applied)

  return (
    <>
      <PageHeader
        title="My Feed"
        description="Articles matching your saved sources, categories and authors."
      />
      {empty ? (
        <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card p-6">
          <h2 className="font-semibold">Set up your feed</h2>
          <p className="text-sm text-muted-foreground">
            Choose the sources, categories or authors you want to follow. My
            Feed shows nothing until you save at least one preference.
          </p>
          <Button asChild size="lg" className="min-h-11">
            <Link to="/preferences">Choose preferences</Link>
          </Button>
        </section>
      ) : (
        <>
          <AppliedPreferences preferences={applied} />
          <ArticleFeed
            filters={filters}
            emptyTitle="No articles match your preferences right now."
            emptyHint="Newer articles may match later. You can also follow more sources, categories or authors."
            emptyAction={editLink}
          />
        </>
      )}
    </>
  )
}

function AppliedPreferences({ preferences }: { preferences: Preferences }) {
  const groups = [
    {
      label: 'Sources',
      values: preferences.sources.map((id) => providerNames[id]),
    },
    {
      label: 'Categories',
      values: preferences.categories.map((id) => categoryLabels[id]),
    },
    { label: 'Authors', values: preferences.authors },
  ].filter((group) => group.values.length)

  return (
    <section
      aria-label="Your preferences"
      className="mb-6 space-y-3 rounded-xl border bg-card p-4"
    >
      <dl className="space-y-2 text-sm">
        {groups.map(({ label, values }) => (
          <div
            key={label}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
          >
            <dt className="font-medium">{label}:</dt>
            <dd className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
              {values.join(', ')}
            </dd>
          </div>
        ))}
      </dl>
      {preferences.authors.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Authors are matched by full name within each batch the sources return,
          so a batch can have no matches even when more articles follow.
        </p>
      )}
      {editLink}
    </section>
  )
}
