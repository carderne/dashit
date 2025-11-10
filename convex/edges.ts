import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { checkDashboardExists } from './dashboards'

// Get all edges for a dashboard
export const list = query({
  args: { dashboardId: v.id('dashboards') },
  handler: async (ctx, { dashboardId }) => {
    // Check if dashboard exists
    const exists = await checkDashboardExists(ctx, dashboardId)
    if (!exists) return []

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
    // Verify dashboard exists
    const exists = await checkDashboardExists(ctx, args.dashboardId)
    if (!exists) throw new Error('Dashboard not found')

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
    const edge = await ctx.db
      .query('edges')
      .withIndex('sourceBoxId', (q) => q.eq('sourceBoxId', sourceBoxId))
      .filter((q) => q.eq(q.field('targetBoxId'), targetBoxId))
      .first()

    if (!edge) throw new Error('Edge not found')

    // Verify dashboard exists
    const exists = await checkDashboardExists(ctx, edge.dashboardId)
    if (!exists) throw new Error('Dashboard not found')

    await ctx.db.delete(edge._id)
  },
})
