import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  users: defineTable({
    email: v.string(),
    authId: v.optional(v.string()),
  }).index('email', ['email']),

  dashboards: defineTable({
    name: v.optional(v.string()),
    userId: v.optional(v.id('users')),
    sessionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('userId', ['userId'])
    .index('sessionId', ['sessionId']),

  boxes: defineTable({
    dashboardId: v.id('dashboards'),
    type: v.union(v.literal('query'), v.literal('table'), v.literal('chart')),
    // Position and size for React Flow
    positionX: v.number(),
    positionY: v.number(),
    width: v.number(),
    height: v.number(),
    // Content depends on type
    // For query: the SQL/query text
    // For table: the query results or data source
    // For chart: JSON ChartBoxConfig (chartType, config, options)
    content: v.optional(v.string()),
    // Store query results as JSON string
    results: v.optional(v.string()),
    // Track last executed query content to show edit status
    lastRunContent: v.optional(v.string()),
    // Timestamps for tracking edit status
    editedAt: v.optional(v.number()),
    runAt: v.optional(v.number()),
    // Metadata
    title: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('dashboardId', ['dashboardId'])
    .index('dashboardId_type', ['dashboardId', 'type']),

  edges: defineTable({
    dashboardId: v.id('dashboards'),
    sourceBoxId: v.id('boxes'),
    targetBoxId: v.id('boxes'),
    createdAt: v.number(),
  })
    .index('dashboardId', ['dashboardId'])
    .index('sourceBoxId', ['sourceBoxId'])
    .index('targetBoxId', ['targetBoxId']),

  datasets: defineTable({
    name: v.string(), // User-friendly name
    fileName: v.string(), // Actual parquet filename
    r2Key: v.optional(v.string()), // R2 object key (null for in-memory datasets)
    fileSizeBytes: v.number(),
    dashboardId: v.id('dashboards'),
    isPublic: v.boolean(), // Public datasets accessible to all
    schema: v.optional(v.array(v.object({ name: v.string(), type: v.string() }))), // Column names and types
    createdAt: v.number(),
    expiresAt: v.optional(v.number()), // Auto-delete timestamp for temp files
  })
    .index('dashboardId', ['dashboardId'])
    .index('isPublic', ['isPublic'])
    .index('expiresAt', ['expiresAt']),
})
