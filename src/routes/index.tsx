import { getConvexServerClient } from '@/clients/convex'
import { Canvas } from '@/components/canvas/canvas'
import { CANVAS_COOKIE_NAME, setCanvasCookie } from '@/lib/session'
import type { AnnotationUpdate } from '@/types/annotation'
import type { BoxUpdate } from '@/types/box'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie } from '@tanstack/react-start/server'
import { useCallback, useEffect, useRef, useState } from 'react'
import z from 'zod'

const dbQueryOptions = (
  id: string | undefined,
  key: string | undefined,
  sessionId: string | undefined,
) =>
  queryOptions({
    queryKey: ['dashboard', id, key],
    queryFn: () => getOrCreateCanvasFn({ data: { id, key, sessionId } }),
  })

const getOrCreateCanvasFn = createServerFn()
  .inputValidator((data: { id?: string; key?: string; sessionId?: string }) => data)
  .handler(async ({ data: { id, key, sessionId } }) => {
    const currentCanvasId = getCookie(CANVAS_COOKIE_NAME)
    const convexClient = getConvexServerClient()

    // If key is provided, look up by key (shared access)
    if (id !== undefined && key !== undefined) {
      try {
        const dashboard = await convexClient.query(api.dashboards.get, {
          id: id as Id<'dashboards'>,
          key,
        })
        // Don't set cookie for shared dashboards
        return { dashboard }
      } catch (_) {
        // Key invalid or access denied
      }
    }

    // Otherwise, try to get by ID or cookie
    const dashboardId = id ?? currentCanvasId
    if (dashboardId !== undefined) {
      try {
        const dashboard = await convexClient.query(api.dashboards.get, {
          id: dashboardId as Id<'dashboards'>,
          sessionId,
        })
        setCanvasCookie(dashboard._id)
        return { dashboard }
      } catch (_) {
        deleteCookie(CANVAS_COOKIE_NAME)
      }
    }

    const dashboard = await convexClient.mutation(api.dashboards.getOrCreate, {
      sessionId,
    })

    if (dashboard === null) {
      throw new Error('Error creating dashboard')
    }

    setCanvasCookie(dashboard._id)
    return { dashboard }
  })

const searchSchema = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
})

export const Route = createFileRoute('/')({
  loaderDeps: ({ search: { id, key } }) => ({ id, key }),
  loader: async ({ context, deps }) =>
    await context.queryClient.ensureQueryData(dbQueryOptions(deps.id, deps.key, context.sessionId)),
  component: RouteComponent,
  validateSearch: searchSchema,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { dashboard } = Route.useLoaderData()
  const { id: searchId, key } = Route.useSearch()
  const { sessionId } = Route.useRouteContext()
  const { _id: dashboardId } = dashboard
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (searchId !== undefined && key === undefined) {
      navigate({ to: Route.to, search: { id: undefined }, replace: true })
    }
  }, [])

  const { data: boxes = [] } = useQuery(
    convexQuery(api.boxes.list, { dashboardId, sessionId, key }),
  )
  const { data: edges = [] } = useQuery(
    convexQuery(api.edges.list, { dashboardId, sessionId, key }),
  )
  const { data: annotations = [] } = useQuery(
    convexQuery(api.annotations.list, { dashboardId, sessionId, key }),
  )

  // Mutations
  const createBox = useConvexMutation(api.boxes.create)
  const updateBoxPosition = useConvexMutation(api.boxes.updatePosition)
  const updateBoxContent = useConvexMutation(api.boxes.updateContent)
  const deleteBox = useConvexMutation(api.boxes.remove)
  const createEdge = useConvexMutation(api.edges.create)
  const deleteEdge = useConvexMutation(api.edges.remove)
  const createAnnotation = useConvexMutation(api.annotations.create)
  const updateAnnotationPosition = useConvexMutation(api.annotations.updatePosition)
  const updateAnnotationContent = useConvexMutation(api.annotations.updateContent)
  const deleteAnnotation = useConvexMutation(api.annotations.remove)

  // Store mutation refs for stable callbacks
  const mutationRefs = useRef({
    createBox,
    updateBoxPosition,
    updateBoxContent,
    deleteBox,
    createEdge,
    deleteEdge,
    createAnnotation,
    updateAnnotationPosition,
    updateAnnotationContent,
    deleteAnnotation,
    dashboardId,
    sessionId,
    key,
  })

  // Update refs on every render
  mutationRefs.current = {
    createBox,
    updateBoxPosition,
    updateBoxContent,
    deleteBox,
    createEdge,
    deleteEdge,
    createAnnotation,
    updateAnnotationPosition,
    updateAnnotationContent,
    deleteAnnotation,
    dashboardId,
    sessionId,
    key,
  }

  // Create stable callbacks that never change identity
  const handleCreateBox = useCallback((type: 'query' | 'table' | 'chart', x: number, y: number) => {
    mutationRefs.current.createBox({
      dashboardId: mutationRefs.current.dashboardId,
      type,
      positionX: x,
      positionY: y,
      sessionId: mutationRefs.current.sessionId,
      key: mutationRefs.current.key,
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
        sessionId: mutationRefs.current.sessionId,
        key: mutationRefs.current.key,
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
        sessionId: mutationRefs.current.sessionId,
        key: mutationRefs.current.key,
      })
    }
  }, [])

  const handleDeleteBox = useCallback((boxId: Id<'boxes'>) => {
    mutationRefs.current.deleteBox({
      id: boxId,
      sessionId: mutationRefs.current.sessionId,
      key: mutationRefs.current.key,
    })
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
        sessionId: mutationRefs.current.sessionId,
        key: mutationRefs.current.key,
      })

      // Create the edge
      await mutationRefs.current.createEdge({
        dashboardId: mutationRefs.current.dashboardId,
        sourceBoxId,
        targetBoxId: newBoxId,
        sessionId: mutationRefs.current.sessionId,
        key: mutationRefs.current.key,
      })
    },
    [],
  )

  const handleCreateEdge = useCallback((sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => {
    mutationRefs.current.createEdge({
      dashboardId: mutationRefs.current.dashboardId,
      sourceBoxId,
      targetBoxId,
      sessionId: mutationRefs.current.sessionId,
      key: mutationRefs.current.key,
    })
  }, [])

  const handleDeleteEdge = useCallback((sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => {
    mutationRefs.current.deleteEdge({
      sourceBoxId,
      targetBoxId,
      sessionId: mutationRefs.current.sessionId,
      key: mutationRefs.current.key,
    })
  }, [])

  const handleCreateAnnotation = useCallback(
    (
      type: 'text' | 'dashed-box' | 'drawing',
      x: number,
      y: number,
      content?: string,
      width?: number,
      height?: number,
    ) => {
      mutationRefs.current.createAnnotation({
        dashboardId: mutationRefs.current.dashboardId,
        type,
        positionX: x,
        positionY: y,
        content,
        width,
        height,
        sessionId: mutationRefs.current.sessionId,
        key: mutationRefs.current.key,
      })
    },
    [],
  )

  const handleUpdateAnnotation = useCallback(
    (annotationId: Id<'annotations'>, updates: AnnotationUpdate) => {
      // Determine if this is a position update or content update
      if ('positionX' in updates || 'positionY' in updates) {
        mutationRefs.current.updateAnnotationPosition({
          id: annotationId,
          positionX: updates.positionX ?? 0,
          positionY: updates.positionY ?? 0,
          width: updates.width,
          height: updates.height,
          sessionId: mutationRefs.current.sessionId,
          key: mutationRefs.current.key,
        })
      } else {
        mutationRefs.current.updateAnnotationContent({
          id: annotationId,
          content: updates.content,
          style: updates.style,
          sessionId: mutationRefs.current.sessionId,
          key: mutationRefs.current.key,
        })
      }
    },
    [],
  )

  const handleDeleteAnnotation = useCallback((annotationId: Id<'annotations'>) => {
    mutationRefs.current.deleteAnnotation({
      id: annotationId,
      sessionId: mutationRefs.current.sessionId,
      key: mutationRefs.current.key,
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
        annotations={annotations}
        sessionId={sessionId}
        shareKey={key}
        onCreateBox={handleCreateBox}
        onUpdateBox={handleUpdateBox}
        onDeleteBox={handleDeleteBox}
        onCreateConnectedBox={handleCreateConnectedBox}
        onCreateEdge={handleCreateEdge}
        onDeleteEdge={handleDeleteEdge}
        onCreateAnnotation={handleCreateAnnotation}
        onUpdateAnnotation={handleUpdateAnnotation}
        onDeleteAnnotation={handleDeleteAnnotation}
      />
    </div>
  )
}
