import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query, type QueryCtx } from './_generated/server'
import { safeGetUser } from './auth'

export async function checkDashboardExists(
  ctx: QueryCtx,
  dashboardId: Id<'dashboards'>,
): Promise<boolean> {
  const dashboard = await ctx.db.get(dashboardId)
  return !!dashboard
}

export async function checkDashboardAccess(
  ctx: QueryCtx,
  dashboardId: Id<'dashboards'>,
  sessionId?: string,
  key?: string,
): Promise<{
  hasAccess: boolean
  isOwner: boolean
  accessMethod: 'userId' | 'sessionId' | 'key' | null
}> {
  const user = await safeGetUser(ctx)

  const dashboard = await ctx.db.get(dashboardId)

  if (!dashboard) {
    throw new Error('Dashboard not found')
  }

  // Check ownership via userId
  if (user && dashboard.userId === user._id) {
    return { hasAccess: true, isOwner: true, accessMethod: 'userId' }
  }

  // Check ownership via sessionId
  if (sessionId && dashboard.sessionId === sessionId) {
    return { hasAccess: true, isOwner: true, accessMethod: 'sessionId' }
  }

  // Check shared access via key
  if (key && dashboard.key && dashboard.key === key) {
    return { hasAccess: true, isOwner: false, accessMethod: 'key' }
  }

  throw new Error('Unauthorized')
}

export const get = query({
  args: {
    id: v.id('dashboards'),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionId, key }) => {
    const dashboard = await ctx.db.get(id)
    if (!dashboard) {
      throw new Error('Dashboard not found')
    }
    await checkDashboardAccess(ctx, dashboard._id, sessionId, key)
    return dashboard
  },
})

export const getOrCreate = mutation({
  args: {
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId }) => {
    const user = await safeGetUser(ctx)

    if (user === null && sessionId === undefined) {
      throw new Error('Need either user or sessionId set to create dashboard')
    }

    // Try to get most recent dashboard for authenticated user
    if (user) {
      const userDashboards = await ctx.db
        .query('dashboards')
        .withIndex('userId', (q) => q.eq('userId', user._id))
        .order('desc')
        .take(1)

      if (userDashboards.length > 0) {
        return userDashboards[0]
      }
    }

    // Try to get most recent dashboard for session
    if (sessionId) {
      const sessionDashboards = await ctx.db
        .query('dashboards')
        .withIndex('sessionId', (q) => q.eq('sessionId', sessionId))
        .order('desc')
        .take(1)

      if (sessionDashboards.length > 0) {
        return sessionDashboards[0]
      }
    }

    // Create new dashboard if none exist
    const now = Date.now()
    const dashboardId = await ctx.db.insert('dashboards', {
      userId: user?._id,
      sessionId: user ? undefined : sessionId, // Only use sessionId if not authenticated
      createdAt: now,
      updatedAt: now,
    })
    const dashboard = await ctx.db.get(dashboardId)
    if (dashboard === null) {
      throw new Error('Error creating dashboard')
    }

    // For guest users, copy template if it exists
    if (user === null) {
      const templateDashboard = await ctx.db
        .query('dashboards')
        .withIndex('key', (q) => q.eq('key', 'template'))
        .first()

      if (templateDashboard) {
        // Get all boxes from template
        const templateBoxes = await ctx.db
          .query('boxes')
          .withIndex('dashboardId', (q) => q.eq('dashboardId', templateDashboard._id))
          .collect()

        // Map old box IDs to new box IDs for edge recreation
        const boxIdMapping = new Map<Id<'boxes'>, Id<'boxes'>>()

        // Copy boxes
        for (const box of templateBoxes) {
          const { _id, _creationTime, dashboardId: _, ...boxData } = box
          const newBoxId = await ctx.db.insert('boxes', {
            ...boxData,
            dashboardId: dashboard._id,
          })
          boxIdMapping.set(box._id, newBoxId)
        }

        // Copy edges with new box IDs
        const templateEdges = await ctx.db
          .query('edges')
          .withIndex('dashboardId', (q) => q.eq('dashboardId', templateDashboard._id))
          .collect()

        for (const edge of templateEdges) {
          const { _id, _creationTime, dashboardId: _, sourceBoxId, targetBoxId, ...edgeData } = edge
          const newSourceBoxId = boxIdMapping.get(sourceBoxId)
          const newTargetBoxId = boxIdMapping.get(targetBoxId)

          if (newSourceBoxId && newTargetBoxId) {
            await ctx.db.insert('edges', {
              ...edgeData,
              dashboardId: dashboard._id,
              sourceBoxId: newSourceBoxId,
              targetBoxId: newTargetBoxId,
            })
          }
        }

        // Copy annotations
        const templateAnnotations = await ctx.db
          .query('annotations')
          .withIndex('dashboardId', (q) => q.eq('dashboardId', templateDashboard._id))
          .collect()

        for (const annotation of templateAnnotations) {
          const { _id, _creationTime, dashboardId: _, ...annotationData } = annotation
          await ctx.db.insert('annotations', {
            ...annotationData,
            dashboardId: dashboard._id,
          })
        }
      }
    }

    return dashboard
  },
})

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

    // Get dataset links for current dashboard
    const datasetLinks = await ctx.db
      .query('datasetInDashboard')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', currentDashboardId))
      .collect()

    if (migrateDatasets) {
      // Clone dataset links to new dashboard
      for (const link of datasetLinks) {
        await ctx.db.insert('datasetInDashboard', {
          datasetId: link.datasetId,
          dashboardId: newDashboardId,
        })
      }
    }

    // Delete dataset links for old dashboard (datasets themselves remain as they're user-owned)
    for (const link of datasetLinks) {
      await ctx.db.delete(link._id)
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

export const migrateSessionDashboards = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, { sessionId }) => {
    const user = await safeGetUser(ctx)
    if (!user) return null

    const existingUserDashboards = await ctx.db
      .query('dashboards')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .collect()

    if (existingUserDashboards.length > 0) {
      // User already has dashboards, just return the most recent one without migrating
      const mostRecent = existingUserDashboards.reduce((latest, current) =>
        current.createdAt > latest.createdAt ? current : latest,
      )
      return mostRecent._id
    }

    // User has no dashboards, proceed with migration
    const dashboards = await ctx.db
      .query('dashboards')
      .withIndex('sessionId', (q) => q.eq('sessionId', sessionId))
      .collect()

    for (const dashboard of dashboards) {
      await ctx.db.patch(dashboard._id, {
        userId: user._id,
        sessionId: undefined,
      })
    }

    if (dashboards.length > 0) {
      const mostRecent = dashboards.reduce((latest, current) =>
        current.createdAt > latest.createdAt ? current : latest,
      )
      return mostRecent._id
    }

    return null
  },
})

export const generateShareKey = mutation({
  args: {
    dashboardId: v.id('dashboards'),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { dashboardId, sessionId }) => {
    const user = await safeGetUser(ctx)

    // Verify ownership (only owner can generate/regenerate key)
    const dashboard = await ctx.db.get(dashboardId)
    if (!dashboard) throw new Error('Dashboard not found')

    const isOwner =
      (user && dashboard.userId === user._id) || (sessionId && dashboard.sessionId === sessionId)

    if (!isOwner) {
      throw new Error('Only dashboard owner can generate share key')
    }

    // Generate a unique key
    const key =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    // Update dashboard with new key
    await ctx.db.patch(dashboardId, { key })

    return { key, shareUrl: `${process.env.CONVEX_SITE_URL}?key=${key}` }
  },
})
