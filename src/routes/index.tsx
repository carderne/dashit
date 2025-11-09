import { Canvas } from '@/components/canvas/canvas'
import type { BoxUpdate } from '@/types/box'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}))
  const { data: dashboards = [] } = useQuery(convexQuery(api.dashboards.list, {}))
  const createDashboard = useConvexMutation(api.dashboards.create)
  const [dashboardId, setDashboardId] = useState<Id<'dashboards'> | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Initialize dashboard from localStorage or create new one
  useEffect(() => {
    async function initializeDashboard() {
      // Check localStorage first
      const storedDashboardId = localStorage.getItem('currentDashboardId')

      if (storedDashboardId) {
        // Verify the dashboard exists
        const dashboardExists = dashboards.some((d) => d._id === storedDashboardId)
        if (dashboardExists) {
          setDashboardId(storedDashboardId as Id<'dashboards'>)
          setIsInitializing(false)
          return
        }
      }

      // No valid dashboard in localStorage, create a new one
      try {
        const newDashboardId = await createDashboard({
          name: 'My Dashboard',
        })
        localStorage.setItem('currentDashboardId', newDashboardId)
        setDashboardId(newDashboardId)
        setIsInitializing(false)
      } catch (error) {
        console.error('Failed to create dashboard:', error)
        setIsInitializing(false)
      }
    }

    // Only initialize once user and dashboards are loaded
    if (user && !isInitializing) {
      return
    }

    if (user) {
      initializeDashboard()
    }
  }, [user, dashboards, createDashboard, isInitializing])

  // Query dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    ...convexQuery(api.dashboards.get, { id: dashboardId! }),
    enabled: !!dashboardId,
  })

  // Query boxes
  const { data: boxes = [], isLoading: boxesLoading } = useQuery({
    ...convexQuery(api.boxes.list, { dashboardId: dashboardId! }),
    enabled: !!dashboardId,
  })

  // Query edges
  const { data: edges = [], isLoading: edgesLoading } = useQuery({
    ...convexQuery(api.edges.list, { dashboardId: dashboardId! }),
    enabled: !!dashboardId,
  })

  // Mutations
  const createBox = useConvexMutation(api.boxes.create)
  const updateBoxPosition = useConvexMutation(api.boxes.updatePosition)
  const updateBoxContent = useConvexMutation(api.boxes.updateContent)
  const deleteBox = useConvexMutation(api.boxes.remove)
  const createEdge = useConvexMutation(api.edges.create)
  const deleteEdge = useConvexMutation(api.edges.remove)

  const handleCreateBox = useCallback(
    (type: 'query' | 'table' | 'chart', x: number, y: number) => {
      if (!dashboardId) return
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
      if (!dashboardId) return
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
      if (!dashboardId) return
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

  if (isInitializing || dashboardLoading || boxesLoading || edgesLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  if (!dashboard || !dashboardId) {
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
