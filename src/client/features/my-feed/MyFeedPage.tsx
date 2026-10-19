import { PageHeader } from '@/components/layout/PageHeader'
import { PlaceholderPanel } from '@/components/layout/PlaceholderPanel'

export function MyFeedPage() {
  return (
    <>
      <PageHeader
        title="My Feed"
        description="Articles matching your saved sources, categories and authors."
      />
      <PlaceholderPanel>
        The personalized feed is not implemented yet.
      </PlaceholderPanel>
    </>
  )
}
