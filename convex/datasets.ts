import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { generatePresignedDownloadUrl, generatePresignedUploadUrl } from './r2'

// List all datasets available to the current user
// Includes: user's own datasets + public datasets + session datasets (for guests)
export const list = query({
  args: {
    sessionId: v.optional(v.string()), // For non-logged-in users
  },
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity()

    // Get user if authenticated
    let user = null
    if (identity) {
      user = await ctx.db
        .query('users')
        .withIndex('email', (q) => q.eq('email', identity.email!))
        .first()
    }

    const datasets = []

    // Get user's own datasets
    if (user) {
      const userDatasets = await ctx.db
        .query('datasets')
        .withIndex('userId', (q) => q.eq('userId', user._id))
        .collect()
      datasets.push(...userDatasets)
    }

    // Get session datasets (for non-logged-in users)
    if (sessionId) {
      const sessionDatasets = await ctx.db
        .query('datasets')
        .withIndex('sessionId', (q) => q.eq('sessionId', sessionId))
        .collect()
      datasets.push(...sessionDatasets)
    }

    // Get public datasets
    const publicDatasets = await ctx.db
      .query('datasets')
      .withIndex('isPublic', (q) => q.eq('isPublic', true))
      .collect()
    datasets.push(...publicDatasets)

    // Remove duplicates (in case a dataset is both user's and public)
    const uniqueDatasets = Array.from(new Map(datasets.map((d) => [d._id, d])).values())

    // Add download URLs for datasets with r2Key
    const datasetsWithUrls = await Promise.all(
      uniqueDatasets.map(async (dataset) => ({
        ...dataset,
        downloadUrl: dataset.r2Key ? await generatePresignedDownloadUrl(dataset.r2Key) : undefined,
      })),
    )

    return datasetsWithUrls
  },
})

// Create a new dataset
export const create = mutation({
  args: {
    name: v.string(),
    fileName: v.string(),
    r2Key: v.optional(v.string()),
    fileSizeBytes: v.number(),
    sessionId: v.optional(v.string()), // For non-logged-in users
    isPublic: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()

    // Get user if authenticated
    let userId = undefined
    if (identity) {
      const user = await ctx.db
        .query('users')
        .withIndex('email', (q) => q.eq('email', identity.email!))
        .first()
      userId = user?._id
    }

    // Either user must be authenticated OR sessionId must be provided
    if (!userId && !args.sessionId) {
      throw new Error('Must be authenticated or provide sessionId')
    }

    const now = Date.now()
    return await ctx.db.insert('datasets', {
      name: args.name,
      fileName: args.fileName,
      r2Key: args.r2Key,
      fileSizeBytes: args.fileSizeBytes,
      userId,
      sessionId: args.sessionId,
      isPublic: args.isPublic ?? false,
      createdAt: now,
      expiresAt: args.expiresAt,
    })
  },
})

// Update dataset metadata (name, isPublic)
export const update = mutation({
  args: {
    id: v.id('datasets'),
    name: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, name, isPublic }) => {
    const identity = await ctx.auth.getUserIdentity()
    const dataset = await ctx.db.get(id)

    if (!dataset) throw new Error('Dataset not found')

    // Check authorization
    if (identity) {
      const user = await ctx.db
        .query('users')
        .withIndex('email', (q) => q.eq('email', identity.email!))
        .first()

      if (user && dataset.userId !== user._id) {
        throw new Error('Not authorized')
      }
    }

    const updates: {
      name?: string
      isPublic?: boolean
    } = {}

    if (name !== undefined) updates.name = name
    if (isPublic !== undefined) updates.isPublic = isPublic

    await ctx.db.patch(id, updates)
  },
})

// Delete a dataset
export const remove = mutation({
  args: {
    id: v.id('datasets'),
    sessionId: v.optional(v.string()), // For non-logged-in users
  },
  handler: async (ctx, { id, sessionId }) => {
    const identity = await ctx.auth.getUserIdentity()
    const dataset = await ctx.db.get(id)

    if (!dataset) throw new Error('Dataset not found')

    // Check authorization
    let authorized = false

    if (identity) {
      const user = await ctx.db
        .query('users')
        .withIndex('email', (q) => q.eq('email', identity.email!))
        .first()

      if (user && dataset.userId === user._id) {
        authorized = true
      }
    }

    // Allow deletion by session ID for guest users
    if (sessionId && dataset.sessionId === sessionId) {
      authorized = true
    }

    if (!authorized) {
      throw new Error('Not authorized')
    }

    await ctx.db.delete(id)
  },
})

// Generate pre-signed R2 upload URL
export const generateUploadUrl = mutation({
  args: {
    fileName: v.string(),
    fileSizeBytes: v.number(),
  },
  handler: async (ctx, { fileName, fileSizeBytes }) => {
    const identity = await ctx.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Must be authenticated to upload to R2')
    }

    // Validate file size (100MB limit)
    const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
    if (fileSizeBytes > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 100MB limit')
    }

    // Generate unique R2 key
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const r2Key = `uploads/${identity.email}/${Date.now()}-${sanitizedFileName}`

    // Generate pre-signed URL for upload
    const uploadUrl = await generatePresignedUploadUrl(r2Key, 3600)

    return {
      uploadUrl,
      r2Key,
      expiresIn: 3600, // 1 hour
    }
  },
})

// Cleanup expired datasets (to be called by cron job)
export const cleanupExpired = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // Find all expired datasets
    const expiredDatasets = await ctx.db.query('datasets').withIndex('expiresAt').collect()

    const toDelete = expiredDatasets.filter((d) => d.expiresAt && d.expiresAt < now)

    // Delete expired datasets
    for (const dataset of toDelete) {
      await ctx.db.delete(dataset._id)
    }

    return { deleted: toDelete.length }
  },
})
