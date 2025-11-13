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
  args: {
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId }) => {
    const user = await safeGetUser(ctx)

    // If authenticated, return user's dashboards
    if (user) {
      return await ctx.db
        .query('dashboards')
        .withIndex('userId', (q) => q.eq('userId', user._id))
        .order('desc')
        .collect()
    }

    // If not authenticated but have sessionId, return session dashboards
    if (sessionId) {
      return await ctx.db
        .query('dashboards')
        .withIndex('sessionId', (q) => q.eq('sessionId', sessionId))
        .order('desc')
        .collect()
    }

    return []
  },
})

// Get a single dashboard
export const get = mutation({
  args: {
    id: v.id('dashboards'),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionId }) => {
    const user = await safeGetUser(ctx)
    const dashboard = await ctx.db.get(id)

    // If authenticated user and dashboard has matching sessionId, migrate to userId
    if (user && dashboard?.sessionId && sessionId && dashboard.sessionId === sessionId) {
      await ctx.db.patch(id, {
        userId: user._id,
        sessionId: undefined, // Clear sessionId after migration
      })
      invariant(dashboard)
      return { ...dashboard, userId: user._id, sessionId: undefined }
    }

    return dashboard
  },
})

// Create a new dashboard
export const create = mutation({
  args: {
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId }) => {
    const user = await safeGetUser(ctx)
    const now = Date.now()

    if (user === undefined && sessionId === undefined) {
      throw new Error('Need either user or sessionId set to create dashbaord')
    }

    const dashboardId = await ctx.db.insert('dashboards', {
      userId: user?._id,
      sessionId: user ? undefined : sessionId, // Only use sessionId if not authenticated
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
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, sessionId }) => {
    const dashboard = await ctx.db.get(id)
    if (!dashboard) throw new Error('Dashboard not found')

    const user = await safeGetUser(ctx)

    // Check ownership: either userId matches or sessionId matches
    const isOwner =
      (user && dashboard.userId === user._id) || (sessionId && dashboard.sessionId === sessionId)

    if (!isOwner) {
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
  args: {
    id: v.id('dashboards'),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionId }) => {
    const dashboard = await ctx.db.get(id)
    if (!dashboard) throw new Error('Dashboard not found')

    const user = await safeGetUser(ctx)

    // Check ownership: either userId matches or sessionId matches
    const isOwner =
      (user && dashboard.userId === user._id) || (sessionId && dashboard.sessionId === sessionId)

    if (!isOwner) {
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
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { currentDashboardId, migrateDatasets, sessionId }) => {
    const user = await safeGetUser(ctx)

    // Verify ownership of current dashboard
    const currentDashboard = await ctx.db.get(currentDashboardId)
    if (!currentDashboard) throw new Error('Dashboard not found')

    const isOwner =
      (user && currentDashboard.userId === user._id) ||
      (sessionId && currentDashboard.sessionId === sessionId)

    if (!isOwner) {
      throw new Error('Not authorized')
    }

    // Create new empty dashboard
    const now = Date.now()
    const newDashboardId = await ctx.db.insert('dashboards', {
      userId: user?._id,
      sessionId: user ? undefined : sessionId,
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

// Migrate all session dashboards to authenticated user
export const migrateSessionDashboards = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, { sessionId }) => {
    const user = await safeGetUser(ctx)
    if (!user) throw new Error('Must be authenticated to migrate session')

    // Find all dashboards with this sessionId
    const dashboards = await ctx.db
      .query('dashboards')
      .withIndex('sessionId', (q) => q.eq('sessionId', sessionId))
      .collect()

    // Migrate each dashboard
    for (const dashboard of dashboards) {
      await ctx.db.patch(dashboard._id, {
        userId: user._id,
        sessionId: undefined,
      })
    }

    return {
      migratedCount: dashboards.length,
    }
  },
})
