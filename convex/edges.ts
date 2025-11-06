import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

// Get all edges for a dashboard
export const list = query({
  args: { dashboardId: v.id('dashboards') },
  handler: async (ctx, { dashboardId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    // Verify dashboard ownership
    const dashboard = await ctx.db.get(dashboardId)
    if (!dashboard) return []

    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', identity.email!))
      .first()

    if (!user || dashboard.userId !== user._id) return []

    return await ctx.db
      .query('edges')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .collect()
  },
})

// Create an edge
export const create = mutation({
  args: {
    dashboardId: v.id('dashboards'),
    sourceBoxId: v.id('boxes'),
    targetBoxId: v.id('boxes'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    // Verify dashboard ownership
    const dashboard = await ctx.db.get(args.dashboardId)
    if (!dashboard) throw new Error('Dashboard not found')

    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', identity.email!))
      .first()

    if (!user || dashboard.userId !== user._id) {
      throw new Error('Not authorized')
    }

    // Check if edge already exists
    const existingEdge = await ctx.db
      .query('edges')
      .withIndex('sourceBoxId', (q) => q.eq('sourceBoxId', args.sourceBoxId))
      .filter((q) => q.eq(q.field('targetBoxId'), args.targetBoxId))
      .first()

    if (existingEdge) {
      return existingEdge._id
    }

    const now = Date.now()
    return await ctx.db.insert('edges', {
      dashboardId: args.dashboardId,
      sourceBoxId: args.sourceBoxId,
      targetBoxId: args.targetBoxId,
      createdAt: now,
    })
  },
})

// Delete an edge
export const remove = mutation({
  args: {
    sourceBoxId: v.id('boxes'),
    targetBoxId: v.id('boxes'),
  },
  handler: async (ctx, { sourceBoxId, targetBoxId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const edge = await ctx.db
      .query('edges')
      .withIndex('sourceBoxId', (q) => q.eq('sourceBoxId', sourceBoxId))
      .filter((q) => q.eq(q.field('targetBoxId'), targetBoxId))
      .first()

    if (!edge) throw new Error('Edge not found')

    const dashboard = await ctx.db.get(edge.dashboardId)
    if (!dashboard) throw new Error('Dashboard not found')

    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', identity.email!))
      .first()

    if (!user || dashboard.userId !== user._id) {
      throw new Error('Not authorized')
    }

    await ctx.db.delete(edge._id)
  },
})
