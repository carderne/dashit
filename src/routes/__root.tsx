/// <reference types="vite/client" />
import { getConvexServerClient } from '@/clients/convex'
import { Toaster } from '@/components/ui/sonner'
import { authClient } from '@/lib/auth-client'
import appCss from '@/styles/app.css?url'
import { seo } from '@/utils/seo'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { fetchSession, getCookieName } from '@convex-dev/better-auth/react-start'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { createAuth } from '@convex/auth'
import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequest } from '@tanstack/react-start/server'
import { ThemeProvider } from 'next-themes'
import * as React from 'react'

const fetchAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { session } = await fetchSession(getRequest())
  const sessionCookieName = getCookieName(createAuth)
  const token = getCookie(sessionCookieName)!

  const convexClient = getConvexServerClient()
  const user = await convexClient.query(api.auth.getCurrentUser)

  return {
    user,
    userId: session?.user.id,
    token,
  }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: 'Dashit',
        description: `Dashit`,
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.png' },
    ],
  }),
  beforeLoad: async (ctx) => {
    const { user, userId, token } = await fetchAuth()

    // During SSR only (the only time serverHttpClient exists),
    // set the auth token to make HTTP queries with.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    return {
      user,
      userId,
      token,
    }
  },
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { convexQueryClient } = useRouteContext({ from: Route.id })
  return (
    <html lang="en" className="light" suppressHydrationWarning={true}>
      <head>
        <HeadContent />
      </head>
      <body className="bg-neutral-950 text-neutral-50">
        <ConvexBetterAuthProvider client={convexQueryClient.convexClient} authClient={authClient}>
          <ThemeProvider attribute="class" defaultTheme="light">
            {children}
            <Toaster />
          </ThemeProvider>
        </ConvexBetterAuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
