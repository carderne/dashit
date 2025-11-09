import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { safeGetUser } from './auth'

// Get all dashboards for the current user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', identity.email!))
      .first()

    if (!user) return []

    return await ctx.db
      .query('dashboards')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()
  },
})

// Get a single dashboard
export const get = query({
  args: { id: v.id('dashboards') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const dashboard = await ctx.db.get(id)
    if (!dashboard) return null

    // Verify ownership
    const user = await safeGetUser(ctx)
    if (!user || dashboard.userId !== user._id) return null

    return dashboard
  },
})

// Create a new dashboard
export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await safeGetUser(ctx)
    if (!user) throw new Error('User not found')

    const now = Date.now()
    return await ctx.db.insert('dashboards', {
      userId: user._id,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Update dashboard
export const update = mutation({
  args: {
    id: v.id('dashboards'),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const dashboard = await ctx.db.get(id)
    if (!dashboard) throw new Error('Dashboard not found')

    const user = await safeGetUser(ctx)
    if (!user || dashboard.userId !== user._id) {
      throw new Error('Not authorized')
    }

    await ctx.db.patch(id, {
      name,
      updatedAt: Date.now(),
    })
  },
})

// Delete dashboard and all its boxes
export const remove = mutation({
  args: { id: v.id('dashboards') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const dashboard = await ctx.db.get(id)
    if (!dashboard) throw new Error('Dashboard not found')

    const user = await safeGetUser(ctx)
    if (!user || dashboard.userId !== user._id) {
      throw new Error('Not authorized')
    }

    // Delete all boxes in the dashboard
    const boxes = await ctx.db
      .query('boxes')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', id))
      .collect()

    for (const box of boxes) {
      await ctx.db.delete(box._id)
    }

    // Delete the dashboard
    await ctx.db.delete(id)
  },
})
