import { PageHeader } from '@/components/layout/PageHeader'
import { PlaceholderPanel } from '@/components/layout/PlaceholderPanel'

export function ExplorePage() {
  return (
    <>
      <PageHeader
        title="Explore"
        description="Search and filter recent articles from The Guardian, The New York Times and NewsAPI."
      />
      <PlaceholderPanel>
        Search, filters and the article feed are not implemented yet.
      </PlaceholderPanel>
    </>
  )
}
