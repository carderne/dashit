import { Presence } from '@convex-dev/presence'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'

export const presence = new Presence(components.presence)

// Heartbeat mutation to update user's presence
export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    return await presence.heartbeat(ctx, roomId, userId, sessionId, interval)
  },
})

// List all users in a room
export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    return await presence.list(ctx, roomToken)
  },
})

// Disconnect user from presence
export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    return await presence.disconnect(ctx, sessionToken)
  },
})

// Update user data in a room (for cursor position and display name)
export const updateRoomUser = mutation({
  args: { roomId: v.string(), userId: v.string(), data: v.any() },
  handler: async (ctx, { roomId, userId, data }) => {
    return await presence.updateRoomUser(ctx, roomId, userId, data)
  },
})

// List only online users in a room (more efficient for cursor tracking)
export const listOnline = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    const result = await presence.list(ctx, roomToken)
    // Filter to only online users on the backend for better performance
    return result.filter((user) => user.online)
  },
})

// Internal mutation to cleanup stale presence records
// Runs daily via cron to remove users who have been offline for > 24 hours
export const cleanupStalePresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    const now = Date.now()
    let cleanedCount = 0

    // Get all dashboards to check their presence records
    const dashboards = await ctx.db.query('dashboards').collect()

    for (const dashboard of dashboards) {
      const roomId = `dashboard:${dashboard._id}`

      try {
        // List all users in this room (online and offline)
        const users = await presence.listRoom(ctx, roomId, false)

        // Remove users who have been offline for more than 24 hours
        for (const user of users) {
          if (!user.online && user.lastDisconnected > 0) {
            const timeSinceDisconnect = now - user.lastDisconnected
            if (timeSinceDisconnect > TWENTY_FOUR_HOURS) {
              await presence.removeRoomUser(ctx, roomId, user.userId)
              cleanedCount++
            }
          }
        }
      } catch (error) {
        console.error(`Error cleaning presence for dashboard ${dashboard._id}:`, error)
      }
    }

    return { cleanedCount }
  },
})
