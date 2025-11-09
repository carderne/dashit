import { getConfig } from '@/lib/config'
import { getCookieName } from '@convex-dev/better-auth/react-start'
import { createAuth } from '@convex/auth'
import { getCookie } from '@tanstack/react-start/server'
import { ConvexHttpClient } from 'convex/browser'

const config = getConfig()

export function getConvexServerClient() {
  const sessionCookieName = getCookieName(createAuth)
  const token = getCookie(sessionCookieName)!
  const client = new ConvexHttpClient(config.convexUrl)
  client.setAuth(token)
  return client
}
