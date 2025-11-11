import usePresence from '@convex-dev/presence/react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

interface CursorData {
  x?: number
  y?: number
  displayName?: string
}

// Get or create a stable browser-specific ID
function getStableBrowserId(): string {
  const key = 'dashit-browser-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = `browser-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`
    localStorage.setItem(key, id)
  }
  return id
}

export function useCursorPresence(dashboardId: Id<'dashboards'>, displayName?: string) {
  const roomId = `dashboard:${dashboardId}`

  // Get current user to use their ID if available, otherwise use stable browser ID
  const { data: user } = useQuery(convexQuery(api.users.getCurrentUser, {}))
  const userId = user?._id || getStableBrowserId()

  // Use the presence hook
  const presenceState = usePresence(api.presence, roomId, userId)

  // Mutation to update cursor position
  const updateRoomUser = useConvexMutation(api.presence.updateRoomUser)

  // Update cursor position
  const updateCursor = useCallback(
    (x: number, y: number) => {
      updateRoomUser({
        roomId,
        userId,
        data: { x, y, displayName },
      })
    },
    [updateRoomUser, roomId, userId, displayName],
  )

  // Filter out current user from presence state
  const otherUsers = useMemo(() => {
    if (!presenceState) return []
    return presenceState
      .filter((u) => u.userId !== userId)
      .map((u) => ({
        id: u.userId,
        data: u.data as CursorData,
        lastPresent: Date.now(), // Simplified - the presence hook handles online status
      }))
  }, [presenceState, userId])

  return {
    updateCursor,
    otherUsers,
    isActive: true,
  }
}
