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
      .query('annotations')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .collect()
  },
})

export const create = mutation({
  args: {
    dashboardId: v.id('dashboards'),
    type: v.union(v.literal('text'), v.literal('dashed-box'), v.literal('drawing')),
    positionX: v.number(),
    positionY: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    content: v.optional(v.string()),
    style: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkDashboardAccess(ctx, args.dashboardId, args.sessionId, args.key)

    // Default sizes based on type
    const defaultWidth =
      args.type === 'text' ? 200 : args.type === 'dashed-box' ? 300 : (args.width ?? 200)
    const defaultHeight =
      args.type === 'text' ? 100 : args.type === 'dashed-box' ? 200 : (args.height ?? 150)

    const now = Date.now()
    return await ctx.db.insert('annotations', {
      dashboardId: args.dashboardId,
      type: args.type,
      positionX: args.positionX,
      positionY: args.positionY,
      width: args.width ?? defaultWidth,
      height: args.height ?? defaultHeight,
      content: args.content,
      style: args.style,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updatePosition = mutation({
  args: {
    id: v.id('annotations'),
    positionX: v.number(),
    positionY: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { id, positionX, positionY, width, height, sessionId, key }) => {
    const annotation = await ctx.db.get(id)
    if (!annotation) throw new Error('Annotation not found')

    await checkDashboardAccess(ctx, annotation.dashboardId, sessionId, key)

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

export const updateContent = mutation({
  args: {
    id: v.id('annotations'),
    content: v.optional(v.string()),
    style: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { id, content, style, sessionId, key }) => {
    const annotation = await ctx.db.get(id)
    if (!annotation) throw new Error('Annotation not found')

    await checkDashboardAccess(ctx, annotation.dashboardId, sessionId, key)

    const updates: {
      updatedAt: number
      content?: string
      style?: string
    } = { updatedAt: Date.now() }
    if (content !== undefined) updates.content = content
    if (style !== undefined) updates.style = style

    await ctx.db.patch(id, updates)
  },
})

export const remove = mutation({
  args: {
    id: v.id('annotations'),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { id, sessionId, key }) => {
    const annotation = await ctx.db.get(id)
    if (!annotation) throw new Error('Annotation not found')

    await checkDashboardAccess(ctx, annotation.dashboardId, sessionId, key)

    await ctx.db.delete(id)
  },
})
