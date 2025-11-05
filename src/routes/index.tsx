import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}))
  return <div>Hello {user?.name}</div>
}
