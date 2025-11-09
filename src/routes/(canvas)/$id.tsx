import { getConvexServerClient } from '@/clients/convex'
import { Canvas } from '@/components/canvas/canvas'
import type { BoxUpdate } from '@/types/box'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useCallback, useEffect, useRef, useState } from 'react'

export const checkDashboardExists = createServerFn()
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data: { id } }) => {
    const convexClient = getConvexServerClient()
    const dashboardId = id as Id<'dashboards'>

    const dashboard = await convexClient.query(api.dashboards.get, { id: dashboardId })
    if (!dashboard) {
      throw redirect({ to: '/dashboards' })
    }
    return dashboard
  })

const dbQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['dashboard', id],
    queryFn: () => checkDashboardExists({ data: { id } }),
  })

export const Route = createFileRoute('/(canvas)/$id')({
  component: DashboardPage,
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(dbQueryOptions(params.id)),
})

function DashboardPage() {
  const { id } = Route.useParams()
  const dashboardId = id as Id<'dashboards'>

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Query boxes
  const { data: boxes = [] } = useQuery(convexQuery(api.boxes.list, { dashboardId }))

  // Query edges
  const { data: edges = [] } = useQuery(convexQuery(api.edges.list, { dashboardId }))

  // Mutations
  const createBox = useConvexMutation(api.boxes.create)
  const updateBoxPosition = useConvexMutation(api.boxes.updatePosition)
  const updateBoxContent = useConvexMutation(api.boxes.updateContent)
  const deleteBox = useConvexMutation(api.boxes.remove)
  const createEdge = useConvexMutation(api.edges.create)
  const deleteEdge = useConvexMutation(api.edges.remove)

  // Store mutation refs for stable callbacks
  const mutationRefs = useRef({
    createBox,
    updateBoxPosition,
    updateBoxContent,
    deleteBox,
    createEdge,
    deleteEdge,
    dashboardId,
  })

  // Update refs on every render
  mutationRefs.current = {
    createBox,
    updateBoxPosition,
    updateBoxContent,
    deleteBox,
    createEdge,
    deleteEdge,
    dashboardId,
  }

  // Create stable callbacks that never change identity
  const handleCreateBox = useCallback(
    (type: 'query' | 'table' | 'chart', x: number, y: number) => {
      mutationRefs.current.createBox({
        dashboardId: mutationRefs.current.dashboardId,
        type,
        positionX: x,
        positionY: y,
      })
    },
    [], // Empty deps - never changes
  )

  const handleUpdateBox = useCallback(
    (boxId: Id<'boxes'>, updates: BoxUpdate) => {
      // Determine if this is a position update or content update
      if ('positionX' in updates || 'positionY' in updates) {
        mutationRefs.current.updateBoxPosition({
          id: boxId,
          positionX: updates.positionX ?? 0,
          positionY: updates.positionY ?? 0,
          width: updates.width,
          height: updates.height,
        })
      } else {
        mutationRefs.current.updateBoxContent({
          id: boxId,
          content: updates.content,
          results: updates.results,
          lastRunContent: updates.lastRunContent,
          editedAt: updates.editedAt,
          runAt: updates.runAt,
          title: updates.title,
        })
      }
    },
    [], // Empty deps - never changes
  )

  const handleDeleteBox = useCallback(
    (boxId: Id<'boxes'>) => {
      mutationRefs.current.deleteBox({ id: boxId })
    },
    [], // Empty deps - never changes
  )

  const handleCreateConnectedBox = useCallback(
    async (
      sourceBoxId: Id<'boxes'>,
      type: 'table' | 'chart',
      position: { x: number; y: number },
    ) => {
      // Create the new box
      const newBoxId = await mutationRefs.current.createBox({
        dashboardId: mutationRefs.current.dashboardId,
        type,
        positionX: position.x,
        positionY: position.y,
      })

      // Create the edge
      await mutationRefs.current.createEdge({
        dashboardId: mutationRefs.current.dashboardId,
        sourceBoxId,
        targetBoxId: newBoxId,
      })
    },
    [], // Empty deps - never changes
  )

  const handleCreateEdge = useCallback(
    (sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => {
      mutationRefs.current.createEdge({
        dashboardId: mutationRefs.current.dashboardId,
        sourceBoxId,
        targetBoxId,
      })
    },
    [], // Empty deps - never changes
  )

  const handleDeleteEdge = useCallback(
    (sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => {
      mutationRefs.current.deleteEdge({
        sourceBoxId,
        targetBoxId,
      })
    },
    [], // Empty deps - never changes
  )

  if (!mounted) {
    return null
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
