import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { checkDashboardExists } from './dashboards'

// Get all boxes for a dashboard
export const list = query({
  args: { dashboardId: v.id('dashboards') },
  handler: async (ctx, { dashboardId }) => {
    // Check if dashboard exists
    const exists = await checkDashboardExists(ctx, dashboardId)
    if (!exists) return []

    return await ctx.db
      .query('boxes')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .collect()
  },
})

// Get boxes within viewport (for viewport culling)
export const listInViewport = query({
  args: {
    dashboardId: v.id('dashboards'),
    minX: v.number(),
    maxX: v.number(),
    minY: v.number(),
    maxY: v.number(),
  },
  handler: async (ctx, { dashboardId, minX, maxX, minY, maxY }) => {
    // Check if dashboard exists
    const exists = await checkDashboardExists(ctx, dashboardId)
    if (!exists) return []

    // Get all boxes and filter by viewport
    const allBoxes = await ctx.db
      .query('boxes')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .collect()

    // Filter boxes that intersect with viewport
    return allBoxes.filter((box) => {
      const boxRight = box.positionX + box.width
      const boxBottom = box.positionY + box.height

      return !(box.positionX > maxX || boxRight < minX || box.positionY > maxY || boxBottom < minY)
    })
  },
})

// Create a new box
export const create = mutation({
  args: {
    dashboardId: v.id('dashboards'),
    type: v.union(v.literal('query'), v.literal('table'), v.literal('chart')),
    positionX: v.number(),
    positionY: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify dashboard exists
    const exists = await checkDashboardExists(ctx, args.dashboardId)
    if (!exists) throw new Error('Dashboard not found')

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

// Update box position and size
export const updatePosition = mutation({
  args: {
    id: v.id('boxes'),
    positionX: v.number(),
    positionY: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, { id, positionX, positionY, width, height }) => {
    const box = await ctx.db.get(id)
    if (!box) throw new Error('Box not found')

    // Verify dashboard exists
    const exists = await checkDashboardExists(ctx, box.dashboardId)
    if (!exists) throw new Error('Dashboard not found')

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

// Update box content
export const updateContent = mutation({
  args: {
    id: v.id('boxes'),
    content: v.optional(v.string()),
    results: v.optional(v.string()),
    lastRunContent: v.optional(v.string()),
    editedAt: v.optional(v.number()),
    runAt: v.optional(v.number()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { id, content, results, lastRunContent, editedAt, runAt, title }) => {
    const box = await ctx.db.get(id)
    if (!box) throw new Error('Box not found')

    // Verify dashboard exists
    const exists = await checkDashboardExists(ctx, box.dashboardId)
    if (!exists) throw new Error('Dashboard not found')

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

// Delete a box
export const remove = mutation({
  args: { id: v.id('boxes') },
  handler: async (ctx, { id }) => {
    const box = await ctx.db.get(id)
    if (!box) throw new Error('Box not found')

    // Verify dashboard exists
    const exists = await checkDashboardExists(ctx, box.dashboardId)
    if (!exists) throw new Error('Dashboard not found')

    await ctx.db.delete(id)
  },
})
