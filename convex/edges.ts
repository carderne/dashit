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

    // Prevent self-loops
    if (args.sourceBoxId === args.targetBoxId) {
      throw new Error('Cannot create edge: self-loops are not allowed')
    }

    // Check for cycles using DFS
    const allEdges = await ctx.db
      .query('edges')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', args.dashboardId))
      .collect()

    // Build adjacency list including the proposed new edge
    const adjacency = new Map<string, Set<string>>()

    for (const edge of allEdges) {
      if (!adjacency.has(edge.sourceBoxId)) {
        adjacency.set(edge.sourceBoxId, new Set())
      }
      adjacency.get(edge.sourceBoxId)!.add(edge.targetBoxId)
    }

    // Add proposed edge
    if (!adjacency.has(args.sourceBoxId)) {
      adjacency.set(args.sourceBoxId, new Set())
    }
    adjacency.get(args.sourceBoxId)!.add(args.targetBoxId)

    // DFS from targetBoxId to see if we can reach sourceBoxId (which would be a cycle)
    const visited = new Set<string>()
    const stack: Array<string> = [args.targetBoxId]

    while (stack.length > 0) {
      const current = stack.pop()!
      if (current === args.sourceBoxId) {
        throw new Error('Cannot create edge: would create a cycle')
      }

      if (visited.has(current)) continue
      visited.add(current)

      const neighbors = adjacency.get(current)
      if (neighbors) {
        for (const neighbor of neighbors) {
          stack.push(neighbor)
        }
      }
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
