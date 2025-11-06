import { Canvas } from '@/components/canvas/canvas'
import type { BoxUpdate } from '@/types/box'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/$id')({
  component: DashboardPage,
})

function DashboardPage() {
  const { id } = Route.useParams()
  const dashboardId = id as Id<'dashboards'>

  // Query dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery(
    convexQuery(api.dashboards.get, { id: dashboardId }),
  )

  // Query boxes
  const { data: boxes = [], isLoading: boxesLoading } = useQuery(
    convexQuery(api.boxes.list, { dashboardId }),
  )

  // Mutations
  const createBox = useConvexMutation(api.boxes.create)
  const updateBoxPosition = useConvexMutation(api.boxes.updatePosition)
  const updateBoxContent = useConvexMutation(api.boxes.updateContent)
  const deleteBox = useConvexMutation(api.boxes.remove)

  const handleCreateBox = (type: 'query' | 'table' | 'chart', x: number, y: number) => {
    createBox({
      dashboardId,
      type,
      positionX: x,
      positionY: y,
    })
  }

  const handleUpdateBox = (boxId: Id<'boxes'>, updates: BoxUpdate) => {
    // Determine if this is a position update or content update
    if ('positionX' in updates || 'positionY' in updates) {
      updateBoxPosition({
        id: boxId,
        positionX: updates.positionX ?? 0,
        positionY: updates.positionY ?? 0,
        width: updates.width,
        height: updates.height,
      })
    } else {
      updateBoxContent({
        id: boxId,
        content: updates.content,
        results: updates.results,
        title: updates.title,
      })
    }
  }

  const handleDeleteBox = (boxId: Id<'boxes'>) => {
    deleteBox({ id: boxId })
  }

  if (dashboardLoading || boxesLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">Dashboard not found</p>
      </div>
    )
  }

  return (
    <div className="h-screen w-full">
      <Canvas
        dashboardId={dashboardId}
        boxes={boxes}
        onCreateBox={handleCreateBox}
        onUpdateBox={handleUpdateBox}
        onDeleteBox={handleDeleteBox}
      />
    </div>
  )
}
