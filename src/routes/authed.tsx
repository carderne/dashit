import { getConvexServerClient } from '@/clients/convex'
import { CANVAS_COOKIE_NAME, SESSION_COOKIE_NAME, setCanvasCookie } from '@/lib/session'
import { api } from '@convex/_generated/api'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie } from '@tanstack/react-start/server'
import z from 'zod'

const migrateUserFn = createServerFn()
  .inputValidator((data: { next?: string }) => data)
  .handler(async ({ data: { next } }) => {
    deleteCookie(CANVAS_COOKIE_NAME)
    const sessionId = getCookie(SESSION_COOKIE_NAME)
    if (!sessionId) {
      return
    }
    deleteCookie(SESSION_COOKIE_NAME)
    const convexClient = getConvexServerClient()
    const dashboardId = await convexClient.mutation(api.dashboards.migrateSessionDashboards, {
      sessionId,
    })
    if (dashboardId !== null) {
      setCanvasCookie(dashboardId)
    }
    if (next !== undefined) {
      throw redirect({ to: next })
    }
    throw redirect({ to: '/' })
  })

const searchSchema = z.object({
  next: z.string().optional(),
})

export const Route = createFileRoute('/authed')({
  loaderDeps: ({ search: { next } }) => ({ next }),
  validateSearch: searchSchema,
  loader: async ({ deps: { next } }) => await migrateUserFn({ data: { next } }),
})
