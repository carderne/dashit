import { getConvexServerClient } from '@/clients/convex'
import { api } from '@convex/_generated/api'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'

export const getOrCreateCanvasFn = createServerFn().handler(async () => {
  const currentCanvasId = getCookie('dashit-canvas-id')
  const convexClient = getConvexServerClient()

  await convexClient.mutation(api.auth.signInAnon, {})

  if (currentCanvasId) {
    throw redirect({
      to: '/$id',
      params: { id: currentCanvasId },
    })
  }
  const newDashboardId = await convexClient.mutation(api.dashboards.create, {})

  setCookie('dashit-canvas-id', newDashboardId, { path: '/', sameSite: 'strict', secure: true })
  throw redirect({
    to: '/$id',
    params: { id: newDashboardId },
  })
})

export const Route = createFileRoute('/')({
  loader: async () => await getOrCreateCanvasFn(),
})
