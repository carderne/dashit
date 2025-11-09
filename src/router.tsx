import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient, notifyManager } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { getConfig } from './lib/config'
import { routeTree } from './routeTree.gen'

const config = getConfig()

export function getRouter() {
  if (typeof document !== 'undefined') {
    notifyManager.setScheduler(window.requestAnimationFrame)
  }

  const convex = new ConvexReactClient(config.convexUrl, {
    expectAuth: true,
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
      <ConvexProvider client={convexQueryClient.convexClient}>{children}</ConvexProvider>
    ),
    scrollRestoration: true,
  })
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })

  return router
}
