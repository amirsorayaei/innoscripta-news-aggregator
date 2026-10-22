import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="This address does not match any page in News Aggregator."
      />
      <Button asChild size="lg">
        <Link to="/explore">Go to Explore</Link>
      </Button>
    </>
  )
}
