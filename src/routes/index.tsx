import { getConvexServerClient } from '@/clients/convex'
import { authClient } from '@/lib/auth-client'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import { useEffect } from 'react'

export const getOrCreateCanvasFn = createServerFn().handler(async () => {
  const currentCanvasId = getCookie('dashit-canvas-id')
  const convexClient = getConvexServerClient()

  if (currentCanvasId) {
    throw redirect({
      to: '/$id',
      params: { id: currentCanvasId },
    })
  }
  try {
    const newDashboardId = await convexClient.mutation(api.dashboards.create, {})

    setCookie('dashit-canvas-id', newDashboardId, { path: '/', sameSite: 'strict', secure: true })
    throw redirect({
      to: '/$id',
      params: { id: newDashboardId },
    })
  } catch (_) {
    //
  }
})

export const Route = createFileRoute('/')({
  loader: async () => await getOrCreateCanvasFn(),
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { user } = Route.useRouteContext()
  const createDashboard = useConvexMutation(api.dashboards.create)
  useEffect(() => {
    const fn = async () => {
      if (!user) {
        await authClient.signIn.anonymous()
        const newDashboardId = await createDashboard({})
        navigate({ to: '/$id', params: { id: newDashboardId } })
      }
    }
    fn()
  }, [!!user])
  return null
}
