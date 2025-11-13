/// <reference types="vite/client" />
import { getConvexServerClient } from '@/clients/convex'
import { AutumnWrapper } from '@/components/autumn-wrapper'
import { Toaster } from '@/components/ui/sonner'
import { authClient } from '@/lib/auth-client'
import appCss from '@/styles/app.css?url'
import { seo } from '@/utils/seo'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { fetchSession, getCookieName } from '@convex-dev/better-auth/react-start'
import { convexQuery, type ConvexQueryClient } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { createAuth } from '@convex/auth'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { ThemeProvider } from 'next-themes'
import * as React from 'react'

// Generate a random session ID
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

const fetchAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { session } = await fetchSession(getRequest())
  const sessionCookieName = getCookieName(createAuth)
  const token = getCookie(sessionCookieName)!

  // Get or create session ID for anonymous users
  const SESSION_COOKIE_NAME = 'dashit-session-id'
  let sessionId = getCookie(SESSION_COOKIE_NAME)

  if (!sessionId) {
    sessionId = generateSessionId()
    setCookie(SESSION_COOKIE_NAME, sessionId, {
      path: '/',
      sameSite: 'strict',
      secure: true,
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  }

  const convexClient = getConvexServerClient()
  const user = await convexClient.query(api.users.getCurrentUser)

  return {
    user,
    userId: session?.user.id,
    token,
    sessionId,
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
    const { user, userId, token, sessionId } = await fetchAuth()

    // During SSR only (the only time serverHttpClient exists),
    // set the auth token to make HTTP queries with.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    return {
      user,
      userId,
      token,
      sessionId,
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
  const { data: user } = useQuery(convexQuery(api.users.getCurrentUser, {}))
  return (
    <html lang="en" className="light" suppressHydrationWarning={true}>
      <head>
        <HeadContent />
      </head>
      <body className="bg-neutral-950 text-neutral-50">
        <ConvexBetterAuthProvider client={convexQueryClient.convexClient} authClient={authClient}>
          <AutumnWrapper>
            <ThemeProvider attribute="class" defaultTheme="light">
              {children}
              <div className="absolute bottom-4 left-40 border-2 border-red-500 bg-white text-black">
                {user?._id} : {user ? 'auth' : 'session'} : {user?.name}
              </div>
              <Toaster />
            </ThemeProvider>
          </AutumnWrapper>
        </ConvexBetterAuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
