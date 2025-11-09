import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Layout, Plus } from 'lucide-react'

export const Route = createFileRoute('/dashboards')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}))
  const { data: dashboards = [] } = useQuery(convexQuery(api.dashboards.list, {}))
  const createDashboard = useConvexMutation(api.dashboards.create)

  const handleCreateDashboard = async () => {
    const newDashboardId = await createDashboard({
      name: `Dashboard ${dashboards.length + 1}`,
    })
    // Store in localStorage and navigate to home
    localStorage.setItem('currentDashboardId', newDashboardId)
    navigate({ to: '/' })
  }

  const handleSelectDashboard = (dashboardId: string) => {
    // Store in localStorage and navigate to home
    localStorage.setItem('currentDashboardId', dashboardId)
    navigate({ to: '/' })
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Hello {user?.name}</h1>
        <p className="text-muted-foreground">Create and manage your data dashboards</p>
      </div>

      <div className="mb-6">
        <Button onClick={handleCreateDashboard} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Create New Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dashboards.map((dashboard) => (
          <div key={dashboard._id} onClick={() => handleSelectDashboard(dashboard._id)}>
            <Card className="cursor-pointer transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Layout className="text-muted-foreground h-5 w-5" />
                  <CardTitle className="text-lg">{dashboard.name}</CardTitle>
                </div>
                <CardDescription>
                  Created {new Date(dashboard.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Click to open dashboard</p>
              </CardContent>
            </Card>
          </div>
        ))}

        {dashboards.length === 0 && (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>No Dashboards Yet</CardTitle>
              <CardDescription>Create your first dashboard to get started</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  )
}
