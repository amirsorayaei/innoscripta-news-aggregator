import { PageHeader } from '@/components/layout/PageHeader'
import { PlaceholderPanel } from '@/components/layout/PlaceholderPanel'

export function PreferencesPage() {
  return (
    <>
      <PageHeader
        title="Preferences"
        description="Choose the sources, categories and authors that shape My Feed."
      />
      <PlaceholderPanel>
        Feed preferences are not implemented yet.
      </PlaceholderPanel>
    </>
  )
}
