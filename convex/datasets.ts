import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { safeGetUser } from './auth'
import { generatePresignedDownloadUrl, generatePresignedUploadUrl } from './r2'

// List all datasets available to the current user
// Includes: user's own datasets + public datasets
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await safeGetUser(ctx)
    const datasets = []

    // Get user's own datasets
    if (user) {
      const userDatasets = await ctx.db
        .query('datasets')
        .withIndex('userId', (q) => q.eq('userId', user._id))
        .collect()
      datasets.push(...userDatasets)
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
    isPublic: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await safeGetUser(ctx)
    if (!user) {
      throw new Error('Must be authenticated')
    }

    const now = Date.now()
    return await ctx.db.insert('datasets', {
      name: args.name,
      fileName: args.fileName,
      r2Key: args.r2Key,
      fileSizeBytes: args.fileSizeBytes,
      userId: user._id,
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
    const dataset = await ctx.db.get(id)

    if (!dataset) throw new Error('Dataset not found')

    const user = await safeGetUser(ctx)
    if (user && dataset.userId !== user._id) {
      throw new Error('Not authorized')
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
  },
  handler: async (ctx, { id }) => {
    const dataset = await ctx.db.get(id)

    if (!dataset) throw new Error('Dataset not found')

    const user = await safeGetUser(ctx)
    if (!user || dataset.userId !== user._id) {
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
    const user = await safeGetUser(ctx)
    if (!user) {
      throw new Error('Not authorized')
    }

    // Validate file size (100MB limit)
    const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
    if (fileSizeBytes > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 100MB limit')
    }

    // Generate unique R2 key
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const r2Key = `uploads/${user._id}/${Date.now()}-${sanitizedFileName}`

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
