import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { authComponent, createAuth } from './auth'

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return null

    const userId = authUser.userId as Id<'users'>

    const user = await ctx.db.get(userId)
    if (!user) return null

    return {
      ...authUser,
    }
  },
})

export const updateUserName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    // Validate name
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      throw new Error('Name cannot be empty')
    }
    if (trimmed.length > 50) {
      throw new Error('Name must be 50 characters or less')
    }

    // Update name in the betterAuth user table
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)
    await auth.api.updateUser({
      body: { name: trimmed },
      headers,
    })

    return { success: true }
  },
})
