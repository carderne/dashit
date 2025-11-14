import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { checkDashboardAccess } from './dashboards'

export const list = query({
  args: {
    dashboardId: v.id('dashboards'),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { dashboardId, sessionId, key }) => {
    await checkDashboardAccess(ctx, dashboardId, sessionId, key)

    return await ctx.db
      .query('boxes')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .collect()
  },
})

export const validateUniqueName = query({
  args: {
    dashboardId: v.id('dashboards'),
    name: v.string(),
    excludeBoxId: v.optional(v.id('boxes')),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { dashboardId, name, excludeBoxId, sessionId, key }) => {
    try {
      await checkDashboardAccess(ctx, dashboardId, sessionId, key)
    } catch {
      return { isValid: false, conflictsWith: 'dashboard-not-found' as const }
    }

    // Normalize name for comparison (case-insensitive, trimmed)
    const normalizedName = name.trim().toLowerCase()

    if (!normalizedName) {
      return { isValid: false, conflictsWith: 'empty' as const }
    }

    // Check against other boxes
    const boxes = await ctx.db
      .query('boxes')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .collect()

    for (const box of boxes) {
      // Skip the box we're editing
      if (excludeBoxId && box._id === excludeBoxId) continue

      // Check if title matches (case-insensitive)
      if (box.title && box.title.trim().toLowerCase() === normalizedName) {
        return { isValid: false, conflictsWith: 'box' as const }
      }
    }

    // Check against datasets linked to this dashboard
    const datasetLinks = await ctx.db
      .query('datasetInDashboard')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .collect()

    for (const link of datasetLinks) {
      const dataset = await ctx.db.get(link.datasetId)
      if (dataset && dataset.name.trim().toLowerCase() === normalizedName) {
        return { isValid: false, conflictsWith: 'dataset' as const }
      }
    }

    return { isValid: true }
  },
})

export const create = mutation({
  args: {
    dashboardId: v.id('dashboards'),
    type: v.union(v.literal('query'), v.literal('table'), v.literal('chart')),
    positionX: v.number(),
    positionY: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    title: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkDashboardAccess(ctx, args.dashboardId, args.sessionId, args.key)

    // Default sizes based on type
    const defaultWidth = args.type === 'query' ? 400 : 600
    const defaultHeight = args.type === 'query' ? 300 : 400

    const now = Date.now()
    return await ctx.db.insert('boxes', {
      dashboardId: args.dashboardId,
      type: args.type,
      positionX: args.positionX,
      positionY: args.positionY,
      width: args.width ?? defaultWidth,
      height: args.height ?? defaultHeight,
      title: args.title,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updatePosition = mutation({
  args: {
    id: v.id('boxes'),
    positionX: v.number(),
    positionY: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { id, positionX, positionY, width, height, sessionId, key }) => {
    const box = await ctx.db.get(id)
    if (!box) throw new Error('Box not found')

    await checkDashboardAccess(ctx, box.dashboardId, sessionId, key)

    const updates: {
      positionX: number
      positionY: number
      updatedAt: number
      width?: number
      height?: number
    } = {
      positionX,
      positionY,
      updatedAt: Date.now(),
    }

    if (width !== undefined) updates.width = width
    if (height !== undefined) updates.height = height

    await ctx.db.patch(id, updates)
  },
})

export const getContentMinimal = query({
  args: {
    id: v.id('boxes'),
  },
  handler: async (ctx, { id }) => {
    // NOTE no auth check done here to keep it fast!
    const box = await ctx.db.get(id)
    if (!box) throw new Error('Box not found')
    return box
  },
})

export const updateContentMinimal = mutation({
  args: {
    id: v.id('boxes'),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { id, content }) => {
    // NOTE no auth check done here to keep it fast!
    const box = await ctx.db.get(id)
    if (!box) throw new Error('Box not found')
    const updates = { content, editedAt: new Date().getTime() }
    await ctx.db.patch(id, updates)
  },
})

export const updateContent = mutation({
  args: {
    id: v.id('boxes'),
    content: v.optional(v.string()),
    results: v.optional(v.string()),
    lastRunContent: v.optional(v.string()),
    editedAt: v.optional(v.number()),
    runAt: v.optional(v.number()),
    title: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { id, content, results, lastRunContent, editedAt, runAt, title, sessionId, key },
  ) => {
    const box = await ctx.db.get(id)
    if (!box) throw new Error('Box not found')

    await checkDashboardAccess(ctx, box.dashboardId, sessionId, key)

    const updates: {
      updatedAt: number
      content?: string
      results?: string
      lastRunContent?: string
      editedAt?: number
      runAt?: number
      title?: string
    } = { updatedAt: Date.now() }
    if (content !== undefined) updates.content = content
    if (results !== undefined) updates.results = results
    if (lastRunContent !== undefined) updates.lastRunContent = lastRunContent
    if (editedAt !== undefined) updates.editedAt = editedAt
    if (runAt !== undefined) updates.runAt = runAt
    if (title !== undefined) updates.title = title

    await ctx.db.patch(id, updates)
  },
})

export const remove = mutation({
  args: {
    id: v.id('boxes'),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionId, key }) => {
    const box = await ctx.db.get(id)
    if (!box) throw new Error('Box not found')

    await checkDashboardAccess(ctx, box.dashboardId, sessionId, key)

    await ctx.db.delete(id)
  },
})
