import { Canvas } from '@/components/canvas/canvas'
import type { BoxUpdate } from '@/types/box'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'

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

  // Query edges
  const { data: edges = [], isLoading: edgesLoading } = useQuery(
    convexQuery(api.edges.list, { dashboardId }),
  )

  // Mutations
  const createBox = useConvexMutation(api.boxes.create)
  const updateBoxPosition = useConvexMutation(api.boxes.updatePosition)
  const updateBoxContent = useConvexMutation(api.boxes.updateContent)
  const deleteBox = useConvexMutation(api.boxes.remove)
  const createEdge = useConvexMutation(api.edges.create)
  const deleteEdge = useConvexMutation(api.edges.remove)

  const handleCreateBox = useCallback(
    (type: 'query' | 'table' | 'chart', x: number, y: number) => {
      createBox({
        dashboardId,
        type,
        positionX: x,
        positionY: y,
      })
    },
    [createBox, dashboardId],
  )

  const handleUpdateBox = useCallback(
    (boxId: Id<'boxes'>, updates: BoxUpdate) => {
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
    },
    [updateBoxPosition, updateBoxContent],
  )

  const handleDeleteBox = useCallback(
    (boxId: Id<'boxes'>) => {
      deleteBox({ id: boxId })
    },
    [deleteBox],
  )

  const handleCreateConnectedBox = useCallback(
    async (
      sourceBoxId: Id<'boxes'>,
      type: 'table' | 'chart',
      position: { x: number; y: number },
    ) => {
      // Create the new box
      const newBoxId = await createBox({
        dashboardId,
        type,
        positionX: position.x,
        positionY: position.y,
      })

      // Create the edge
      await createEdge({
        dashboardId,
        sourceBoxId,
        targetBoxId: newBoxId,
      })
    },
    [createBox, createEdge, dashboardId],
  )

  const handleCreateEdge = useCallback(
    (sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => {
      createEdge({
        dashboardId,
        sourceBoxId,
        targetBoxId,
      })
    },
    [createEdge, dashboardId],
  )

  const handleDeleteEdge = useCallback(
    (sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => {
      deleteEdge({
        sourceBoxId,
        targetBoxId,
      })
    },
    [deleteEdge],
  )

  if (dashboardLoading || boxesLoading || edgesLoading) {
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
        edges={edges}
        onCreateBox={handleCreateBox}
        onUpdateBox={handleUpdateBox}
        onDeleteBox={handleDeleteBox}
        onCreateConnectedBox={handleCreateConnectedBox}
        onCreateEdge={handleCreateEdge}
        onDeleteEdge={handleDeleteEdge}
      />
    </div>
  )
}
