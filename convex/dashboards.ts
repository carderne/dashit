import { v } from 'convex/values'
import { invariant } from '../src/lib/invariant'
import type { Id } from './_generated/dataModel'
import { mutation, query, type QueryCtx } from './_generated/server'
import { safeGetUser } from './auth'
import { deleteR2Object } from './r2'

// Helper function to check if dashboard exists
export async function checkDashboardExists(
  ctx: QueryCtx,
  dashboardId: Id<'dashboards'>,
): Promise<boolean> {
  const dashboard = await ctx.db.get(dashboardId)
  return !!dashboard
}

// Get all dashboards for the current user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await safeGetUser(ctx)
    if (!user) return []

    return await ctx.db
      .query('dashboards')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()
  },
})

// Get a single dashboard
export const get = mutation({
  args: { id: v.id('dashboards') },
  handler: async (ctx, { id }) => {
    const user = await safeGetUser(ctx)
    const dashboard = await ctx.db.get(id)

    if (user !== undefined && dashboard?.userId === undefined) {
      await ctx.db.patch(id, { userId: user._id })
      invariant(dashboard)
      return { ...dashboard, userId: user._id }
    }

    return dashboard
  },
})

// Create a new dashboard
export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await safeGetUser(ctx)
    const now = Date.now()
    const dashboardId = await ctx.db.insert('dashboards', {
      userId: user?._id,
      createdAt: now,
      updatedAt: now,
    })
    const dashboard = await ctx.db.get(dashboardId)
    return dashboard
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

// Clear canvas: Create new dashboard with optional dataset migration
export const clearCanvas = mutation({
  args: {
    currentDashboardId: v.id('dashboards'),
    migrateDatasets: v.boolean(),
  },
  handler: async (ctx, { currentDashboardId, migrateDatasets }) => {
    const user = await safeGetUser(ctx)
    if (!user) throw new Error('Not authenticated')

    // Verify user owns current dashboard
    const currentDashboard = await ctx.db.get(currentDashboardId)
    if (!currentDashboard) throw new Error('Dashboard not found')
    if (currentDashboard.userId !== user._id) {
      throw new Error('Not authorized')
    }

    // Create new empty dashboard
    const now = Date.now()
    const newDashboardId = await ctx.db.insert('dashboards', {
      userId: user._id,
      createdAt: now,
      updatedAt: now,
    })

    // Get datasets for current dashboard
    const datasets = await ctx.db
      .query('datasets')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', currentDashboardId))
      .collect()

    if (migrateDatasets) {
      // Clone dataset records with new dashboardId
      for (const dataset of datasets) {
        await ctx.db.insert('datasets', {
          name: dataset.name,
          fileName: dataset.fileName,
          r2Key: dataset.r2Key,
          fileSizeBytes: dataset.fileSizeBytes,
          dashboardId: newDashboardId,
          isPublic: dataset.isPublic,
          createdAt: now,
          expiresAt: dataset.expiresAt,
        })
      }
    } else {
      // Delete datasets from R2 and database
      for (const dataset of datasets) {
        // Delete from R2 if it has an r2Key
        if (dataset.r2Key) {
          try {
            await deleteR2Object(dataset.r2Key)
          } catch (error) {
            console.error(`Failed to delete R2 object ${dataset.r2Key}:`, error)
            // Continue with database deletion even if R2 deletion fails
          }
        }
        // Delete from database
        await ctx.db.delete(dataset._id)
      }
    }

    // Delete all boxes in the old dashboard
    const boxes = await ctx.db
      .query('boxes')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', currentDashboardId))
      .collect()

    for (const box of boxes) {
      await ctx.db.delete(box._id)
    }

    // Delete all edges in the old dashboard
    const edges = await ctx.db
      .query('edges')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', currentDashboardId))
      .collect()

    for (const edge of edges) {
      await ctx.db.delete(edge._id)
    }

    // Delete the old dashboard
    await ctx.db.delete(currentDashboardId)

    return newDashboardId
  },
})
