import { CheckCircle2, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { categoryIds, categoryLabels } from '@shared/categories'
import { providerIds, providerNames } from '@shared/providers'
import { PageHeader } from '@/components/layout/PageHeader'
import { ToggleChip } from '@/components/ToggleChip'
import { Button } from '@/components/ui/button'
import { toggle } from '@/features/explore/filter-draft'
import { AuthorPicker } from './AuthorPicker'
import { usePreferencesDraft } from './use-preferences-draft'

export const NOT_PERSISTED_MESSAGE = 'Changes are not persisted on this device.'

export function PreferencesPage() {
  const {
    draft,
    dirty,
    persisted,
    feedback,
    canSave,
    update,
    reset,
    cancel,
    submit,
  } = usePreferencesDraft()

  return (
    <>
      <PageHeader
        title="Preferences"
        description="Choose the sources, categories and authors that shape My Feed. Empty groups don’t restrict anything."
      />

      {!persisted && (
        <div className="mb-6 flex gap-3 rounded-lg border border-warning-foreground/20 bg-warning p-3 text-sm text-warning-foreground">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <p>
            {NOT_PERSISTED_MESSAGE} Saved preferences still apply to My Feed
            until this tab is closed or reloaded.
          </p>
        </div>
      )}

      <form
        className="space-y-4 pb-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSave) submit()
        }}
      >
        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <fieldset>
            <legend className="text-base font-semibold">Sources</legend>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              Articles from any selected source are included.
            </p>
            <div className="flex flex-wrap gap-2">
              {providerIds.map((id) => (
                <ToggleChip
                  key={id}
                  className="min-h-11"
                  pressed={draft.sources.includes(id)}
                  onClick={() =>
                    update({ ...draft, sources: toggle(draft.sources, id) })
                  }
                >
                  {providerNames[id]}
                </ToggleChip>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <fieldset>
            <legend className="text-base font-semibold">Categories</legend>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              Articles in any selected category are included. NewsAPI categories
              describe the publisher, not each article.
            </p>
            <div className="flex flex-wrap gap-2">
              {categoryIds.map((id) => (
                <ToggleChip
                  key={id}
                  className="min-h-11"
                  pressed={draft.categories.includes(id)}
                  onClick={() =>
                    update({
                      ...draft,
                      categories: toggle(draft.categories, id),
                    })
                  }
                >
                  {categoryLabels[id]}
                </ToggleChip>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <AuthorPicker
            selected={draft.authors}
            onChange={(authors) => update({ ...draft, authors })}
          />
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <p role="status" className="mr-auto min-w-0 text-sm">
            <SaveStatus dirty={dirty} feedback={feedback} />
          </p>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="min-h-11"
            onClick={reset}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11"
            onClick={cancel}
            disabled={!dirty}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="min-h-11"
            disabled={!canSave}
          >
            Save
          </Button>
        </div>
      </form>
    </>
  )
}

function SaveStatus({
  dirty,
  feedback,
}: Pick<ReturnType<typeof usePreferencesDraft>, 'dirty' | 'feedback'>) {
  if (dirty)
    return (
      <span className="text-muted-foreground">You have unsaved changes.</span>
    )
  if (feedback === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-primary">
        <CheckCircle2 aria-hidden="true" className="size-4" />
        Preferences saved.{' '}
        <Link to="/my-feed" className="underline underline-offset-2">
          View My Feed
        </Link>
      </span>
    )
  }
  if (feedback === 'not-persisted') {
    return (
      <span className="text-warning-foreground">
        Preferences applied to My Feed. {NOT_PERSISTED_MESSAGE}
      </span>
    )
  }
  return null
}
