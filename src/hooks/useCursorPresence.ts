import usePresence from '@convex-dev/presence/react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useQuery } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { useCallback, useMemo, useRef } from 'react'

interface CursorData {
  x?: number
  y?: number
  displayName?: string
}

// Generate a short guest name from sessionId
function generateGuestName(sessionId: string): string {
  // Take last 4 characters of sessionId for a short identifier
  const shortId = sessionId.slice(-4).toUpperCase()
  return `Guest ${shortId}`
}

export function useCursorPresence(dashboardId: Id<'dashboards'>, displayName?: string) {
  const roomId = `dashboard:${dashboardId}`

  // Get current user and sessionId from route context
  const { user, sessionId } = useRouteContext({ strict: false })
  const { data: authUser } = useQuery(convexQuery(api.auth.getCurrentUser, {}))

  // Use userId for authenticated users, sessionId for session users
  const presenceUserId = user?._id || sessionId || 'no-presence'

  // Generate display name for session users
  const effectiveDisplayName = useMemo(() => {
    if (displayName) return displayName
    if (user) return authUser?.name || 'User'
    if (sessionId) return generateGuestName(sessionId)
    return 'Anonymous'
  }, [displayName, user, authUser?.name, sessionId])

  // Use the presence hook with either userId or sessionId
  const presenceState = usePresence(api.presence, roomId, presenceUserId)

  // Mutation to update cursor position
  const updateRoomUser = useConvexMutation(api.presence.updateRoomUser)

  // Throttling refs
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null)

  // Update cursor position - works for both authenticated and session users
  // Throttled to prevent OCC failures from rapid mutations
  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (presenceUserId === 'no-presence') return // Only skip if no presence ID at all

      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current
      const THROTTLE_MS = 100 // Update at most every 100ms

      // Store the latest cursor position
      pendingCursorRef.current = { x, y }

      if (timeSinceLastUpdate >= THROTTLE_MS) {
        // Enough time has passed, update immediately
        lastUpdateTimeRef.current = now
        updateRoomUser({
          roomId,
          userId: presenceUserId,
          data: { x, y, displayName: effectiveDisplayName },
        })
        pendingCursorRef.current = null

        // Clear any pending timeout
        if (throttleTimeoutRef.current) {
          clearTimeout(throttleTimeoutRef.current)
          throttleTimeoutRef.current = null
        }
      } else {
        // Too soon, schedule an update
        if (!throttleTimeoutRef.current) {
          const delay = THROTTLE_MS - timeSinceLastUpdate
          throttleTimeoutRef.current = setTimeout(() => {
            if (pendingCursorRef.current) {
              lastUpdateTimeRef.current = Date.now()
              updateRoomUser({
                roomId,
                userId: presenceUserId,
                data: {
                  x: pendingCursorRef.current.x,
                  y: pendingCursorRef.current.y,
                  displayName: effectiveDisplayName,
                },
              })
              pendingCursorRef.current = null
            }
            throttleTimeoutRef.current = null
          }, delay)
        }
      }
    },
    [updateRoomUser, roomId, presenceUserId, effectiveDisplayName],
  )

  // Filter out current user from presence state
  const otherUsers = useMemo(() => {
    if (!presenceState || presenceUserId === 'no-presence') return []

    // Group by userId and keep only the most recent session
    // This handles cases where a user has multiple tabs/sessions open
    const userMap = new Map<string, { id: string; data: CursorData; lastPresent: number }>()

    // 5 minute staleness threshold
    const FIVE_MINUTES = 5 * 60 * 1000
    const now = Date.now()

    presenceState
      .filter((u) => u.userId !== presenceUserId) // Filter out current user
      .filter((u) => u.userId !== 'no-presence') // Filter out users with no presence ID
      .filter((u) => u.online) // Only show online users
      .filter((u) => {
        // Filter out stale cursors (not updated in 5 minutes)
        const lastActive = u.online ? now : u.lastDisconnected
        return now - lastActive < FIVE_MINUTES
      })
      .forEach((u) => {
        const userData = u.data as CursorData

        // Deduplicate by userId, keeping the most recently added one
        // Use actual lastDisconnected timestamp for offline users, current time for online
        userMap.set(u.userId, {
          id: u.userId,
          data: userData,
          lastPresent: u.online ? now : u.lastDisconnected,
        })
      })

    return Array.from(userMap.values())
  }, [presenceState, presenceUserId])

  return {
    updateCursor,
    otherUsers,
    isActive: true,
  }
}
