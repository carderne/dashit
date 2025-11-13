import usePresence from '@convex-dev/presence/react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useRef } from 'react'

interface CursorData {
  x?: number
  y?: number
  displayName?: string
}

export function useCursorPresence(dashboardId: Id<'dashboards'>, displayName?: string) {
  const roomId = `dashboard:${dashboardId}`

  // Get current user - only use userId if authenticated, otherwise don't participate in presence
  const { data: user } = useQuery(convexQuery(api.users.getCurrentUser, {}))
  const userId = user?._id

  // Use the presence hook only if we have a real userId
  const presenceState = usePresence(api.presence, roomId, userId || 'anonymous-no-cursor')

  // Mutation to update cursor position
  const updateRoomUser = useConvexMutation(api.presence.updateRoomUser)

  // Throttling refs
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null)

  // Update cursor position - only if we have a real userId
  // Throttled to prevent OCC failures from rapid mutations
  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (!userId) return // Don't send cursor updates if not authenticated

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
          userId,
          data: { x, y, displayName },
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
                userId,
                data: {
                  x: pendingCursorRef.current.x,
                  y: pendingCursorRef.current.y,
                  displayName,
                },
              })
              pendingCursorRef.current = null
            }
            throttleTimeoutRef.current = null
          }, delay)
        }
      }
    },
    [updateRoomUser, roomId, userId, displayName],
  )

  // Filter out current user from presence state
  const otherUsers = useMemo(() => {
    if (!presenceState || !userId) return []

    // Group by userId and keep only the most recent session
    // This handles cases where a user has multiple tabs/sessions open
    const userMap = new Map<string, { id: string; data: CursorData; lastPresent: number }>()

    // 5 minute staleness threshold
    const FIVE_MINUTES = 5 * 60 * 1000
    const now = Date.now()

    presenceState
      .filter((u) => u.userId !== userId)
      .filter((u) => u.userId !== 'anonymous-no-cursor') // Filter out anonymous users
      .filter((u) => !u.userId.startsWith('browser-')) // Filter out browser-based IDs
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
  }, [presenceState, userId])

  return {
    updateCursor,
    otherUsers,
    isActive: true,
  }
}
