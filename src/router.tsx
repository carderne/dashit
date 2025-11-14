import { ConvexQueryClient } from '@convex-dev/react-query'
import { notifyManager, QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter, ErrorComponent } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { PostHogProvider } from 'posthog-js/react'
import { NotFoundComponent } from './components/not-found'
import { getConfig } from './lib/config'
import { routeTree } from './routeTree.gen'

const config = getConfig()

export function getRouter() {
  if (typeof document !== 'undefined') {
    notifyManager.setScheduler(window.requestAnimationFrame)
  }

  const convex = new ConvexReactClient(config.convexUrl, {
    expectAuth: false,
  })
  const convexQueryClient = new ConvexQueryClient(convex)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',
    context: { queryClient, convexQueryClient },
    Wrap: ({ children }) => (
      <PostHogProvider
        apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
        options={{
          api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
          defaults: '2025-05-24',
          capture_exceptions: true,
          debug: import.meta.env.MODE === 'development',
        }}
      >
        <ConvexProvider client={convexQueryClient.convexClient}>{children}</ConvexProvider>
      </PostHogProvider>
    ),
    scrollRestoration: true,
    defaultNotFoundComponent: () => <NotFoundComponent />,
    defaultErrorComponent: ErrorComponent,
  })
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })

  return router
}
