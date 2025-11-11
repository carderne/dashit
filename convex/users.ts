import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { authComponent } from './auth'

// Get current user with display name
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return null

    const userId = authUser.userId as Id<'users'>
    if (!userId) return null

    const user = await ctx.db.get(userId)
    if (!user) return null

    return {
      ...user,
      betterAuthId: authUser._id,
      name: authUser.name,
      image: authUser.image,
    }
  },
})

// Update user's display name
export const updateDisplayName = mutation({
  args: {
    displayName: v.string(),
  },
  handler: async (ctx, { displayName }) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      throw new Error('Not authenticated')
    }

    const userId = authUser.userId as Id<'users'>
    if (!userId) {
      throw new Error('User ID not found')
    }

    // Validate display name
    const trimmed = displayName.trim()
    if (trimmed.length === 0) {
      throw new Error('Display name cannot be empty')
    }
    if (trimmed.length > 50) {
      throw new Error('Display name must be 50 characters or less')
    }

    // Update display name in users table
    await ctx.db.patch(userId, {
      displayName: trimmed,
    })

    return { success: true }
  },
})
