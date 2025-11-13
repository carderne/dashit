import { getConvexServerClient } from '@/clients/convex'
import { Canvas } from '@/components/canvas/canvas'
import type { BoxUpdate } from '@/types/box'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { useCallback, useEffect, useRef, useState } from 'react'
import z from 'zod'

const dbQueryOptions = (id: string | undefined) =>
  queryOptions({
    queryKey: ['dashboard', id],
    queryFn: () => getOrCreateCanvasFn({ data: { id } }),
  })

const COOKIE_NAME = 'dashit-canvas-id'
const SESSION_COOKIE_NAME = 'dashit-session-id'

const getOrCreateCanvasFn = createServerFn()
  .inputValidator((data: { id?: string }) => data)
  .handler(async ({ data: { id } }) => {
    const currentCanvasId = getCookie(COOKIE_NAME)
    const sessionId = getCookie(SESSION_COOKIE_NAME)
    const convexClient = getConvexServerClient()

    const dashboardId = id ?? currentCanvasId

    if (dashboardId) {
      try {
        const dashboard = await convexClient.mutation(api.dashboards.get, {
          id: dashboardId as Id<'dashboards'>,
          sessionId,
        })
        if (dashboard !== null) {
          setCookie(COOKIE_NAME, dashboard._id, {
            path: '/',
            sameSite: 'strict',
            secure: true,
          })
          return { dashboard }
        }
      } catch (_) {
        deleteCookie(COOKIE_NAME)
      }
    }
    const dashboard = await convexClient.mutation(api.dashboards.create, {
      sessionId,
    })

    if (dashboard === null) {
      throw new Error('Error creating dashboard')
    }

    setCookie(COOKIE_NAME, dashboard._id, { path: '/', sameSite: 'strict', secure: true })
    return { dashboard }
  })

const searchSchema = z.object({
  id: z.string().optional(),
})

export const Route = createFileRoute('/')({
  loaderDeps: ({ search: { id } }) => ({ id }),
  loader: async ({ context, deps }) =>
    await context.queryClient.ensureQueryData(dbQueryOptions(deps.id)),
  component: RouteComponent,
  validateSearch: searchSchema,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { dashboard } = Route.useLoaderData()
  const { id: searchId } = Route.useSearch()
  const { _id: dashboardId } = dashboard
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (searchId) {
      navigate({ to: Route.to, search: { id: undefined }, replace: true })
    }
  }, [])

  const { data: boxes = [] } = useQuery(convexQuery(api.boxes.list, { dashboardId }))
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
  const handleCreateBox = useCallback((type: 'query' | 'table' | 'chart', x: number, y: number) => {
    mutationRefs.current.createBox({
      dashboardId: mutationRefs.current.dashboardId,
      type,
      positionX: x,
      positionY: y,
    })
  }, [])

  const handleUpdateBox = useCallback((boxId: Id<'boxes'>, updates: BoxUpdate) => {
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
  }, [])

  const handleDeleteBox = useCallback((boxId: Id<'boxes'>) => {
    mutationRefs.current.deleteBox({ id: boxId })
  }, [])

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
    [],
  )

  const handleCreateEdge = useCallback((sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => {
    mutationRefs.current.createEdge({
      dashboardId: mutationRefs.current.dashboardId,
      sourceBoxId,
      targetBoxId,
    })
  }, [])

  const handleDeleteEdge = useCallback((sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => {
    mutationRefs.current.deleteEdge({
      sourceBoxId,
      targetBoxId,
    })
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="h-screen w-full">
      <Canvas
        dashboard={dashboard}
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
