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
  Link,
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
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
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

function NotFoundComponent() {
  return (
    <RootDocument>
      <div className="canvas-grid-404 relative flex h-screen w-full items-center justify-center overflow-hidden">
        {/* Diffuse glows - sparse, lost purple/slate theme */}
        <div className="pointer-events-none absolute top-[-200px] left-[-200px] h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute right-[-200px] bottom-[-200px] h-[600px] w-[600px] rounded-full bg-slate-500/10 blur-[120px]" />

        <div className="relative">
          {/* Glassy card */}
          <div className="relative rounded-3xl border border-white/20 bg-white/50 p-12 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            {/* Gradient overlay for extra depth */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/50 to-transparent dark:from-white/5 dark:to-transparent" />

            {/* Content */}
            <div className="relative space-y-6 text-center">
              <div className="space-y-2">
                <h1 className="bg-gradient-to-br from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-6xl font-bold text-transparent dark:from-white dark:via-slate-300 dark:to-white">
                  404
                </h1>
                <p className="text-xl font-medium text-slate-700 dark:text-slate-300">
                  Sorry, you lost your way
                </p>
              </div>

              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-900 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                Take me home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </RootDocument>
  )
}

function ErrorComponent({ error }: { error: Error }) {
  return (
    <RootDocument>
      <div className="canvas-grid-error relative flex h-screen w-full items-center justify-center overflow-hidden">
        {/* Diffuse glows - urgent red/orange theme */}
        <div className="pointer-events-none absolute top-[-200px] left-[-200px] h-[600px] w-[600px] rounded-full bg-red-500/15 blur-[120px]" />
        <div className="pointer-events-none absolute right-[-200px] bottom-[-200px] h-[600px] w-[600px] rounded-full bg-orange-500/15 blur-[120px]" />

        <div className="relative max-w-2xl">
          {/* Glassy card */}
          <div className="relative rounded-3xl border border-white/20 bg-white/50 p-12 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            {/* Gradient overlay for extra depth */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/50 to-transparent dark:from-white/5 dark:to-transparent" />

            {/* Content */}
            <div className="relative space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="bg-gradient-to-br from-red-600 via-orange-600 to-red-600 bg-clip-text text-5xl font-bold text-transparent dark:from-red-400 dark:via-orange-400 dark:to-red-400">
                  Oops! Something went wrong
                </h1>
                <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                  We encountered an unexpected error
                </p>
              </div>

              {/* Error details */}
              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 backdrop-blur-sm dark:border-red-900/50 dark:bg-red-950/30">
                <h2 className="mb-2 text-sm font-semibold text-red-900 dark:text-red-300">
                  Error Details:
                </h2>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-400">
                      {error.name || 'Error'}
                    </p>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error.message}</p>
                  </div>
                  {error.stack && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-red-800 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                        Stack Trace
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-red-100/50 p-3 text-xs text-red-900 dark:bg-red-950/50 dark:text-red-200">
                        {error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-center gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-900 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RootDocument>
  )
}
