import { createFileRoute } from '@tanstack/react-router'
import { DynamicPage } from '@/features/pages'

export const Route = createFileRoute('/_authenticated/pages/$slug')({
  component: RouteComponent,
})

// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { slug } = Route.useParams()

  return <DynamicPage slug={slug} />
}
