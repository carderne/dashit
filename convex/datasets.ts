import { v } from 'convex/values'
import { api } from './_generated/api'
import { action, mutation, query } from './_generated/server'
import { safeGetUser } from './auth'
import { autumn } from './autumn'
import { checkDashboardExists } from './dashboards'
import { generatePresignedDownloadUrl, generatePresignedUploadUrl } from './r2'
import type { Result } from './types'

// List all datasets for a specific dashboard + public datasets
export const list = query({
  args: { dashboardId: v.id('dashboards') },
  handler: async (ctx, { dashboardId }) => {
    const datasets = []

    // Check if dashboard exists
    const exists = await checkDashboardExists(ctx, dashboardId)
    if (!exists) return []

    // Get datasets for this specific dashboard
    const dashboardDatasets = await ctx.db
      .query('datasets')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .collect()
    datasets.push(...dashboardDatasets)

    // Get public datasets
    const publicDatasets = await ctx.db
      .query('datasets')
      .withIndex('isPublic', (q) => q.eq('isPublic', true))
      .collect()
    datasets.push(...publicDatasets)

    // Remove duplicates (in case a dataset is both dashboard-owned and public)
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

// Internal mutation to create a dataset (called by action)
export const createInternal = mutation({
  args: {
    name: v.string(),
    fileName: v.string(),
    r2Key: v.optional(v.string()),
    fileSizeBytes: v.number(),
    dashboardId: v.id('dashboards'), // Required - all datasets must belong to a dashboard
    isPublic: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
    schema: v.optional(v.array(v.object({ name: v.string(), type: v.string() }))),
  },
  handler: async (ctx, args) => {
    const user = await safeGetUser(ctx)
    if (!user) {
      throw new Error('Must be authenticated')
    }

    // Verify dashboard exists
    const exists = await checkDashboardExists(ctx, args.dashboardId)
    if (!exists) {
      throw new Error('Dashboard not found')
    }

    const now = Date.now()
    const datasetId = await ctx.db.insert('datasets', {
      name: args.name,
      fileName: args.fileName,
      r2Key: args.r2Key,
      fileSizeBytes: args.fileSizeBytes,
      dashboardId: args.dashboardId,
      isPublic: args.isPublic ?? false,
      schema: args.schema,
      createdAt: now,
      expiresAt: args.expiresAt,
    })

    return datasetId
  },
})

// Create a new dataset with usage tracking
export const create = action({
  args: {
    name: v.string(),
    fileName: v.string(),
    r2Key: v.optional(v.string()),
    fileSizeBytes: v.number(),
    dashboardId: v.id('dashboards'), // Required - all datasets must belong to a dashboard
    isPublic: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
    schema: v.optional(v.array(v.object({ name: v.string(), type: v.string() }))),
  },
  handler: async (ctx, args): Promise<Result<string>> => {
    // Check usage limit for file uploads
    const { data: usageCheck, error: checkError } = await autumn.check(ctx, {
      featureId: 'file_upload',
    })

    if (checkError) {
      console.error('Failed to check file upload usage:', checkError)
      return {
        ok: false,
        message: 'Failed to check usage limits',
        code: 'CHECK_ERROR',
      }
    }

    if (!usageCheck?.allowed) {
      return {
        ok: false,
        message: "You've used up your upload quota, upgrade for more",
        code: 'QUOTA_EXCEEDED',
      }
    }

    try {
      // Create the dataset via mutation
      const datasetId: string = await ctx.runMutation(api.datasets.createInternal, args)

      // Track usage for file upload
      const { error: trackError } = await autumn.track(ctx, {
        featureId: 'file_upload',
        value: 1,
      })

      if (trackError) {
        console.error('Failed to track file upload usage:', trackError)
        // Don't fail the request, just log the error
      }

      return { ok: true, data: datasetId }
    } catch (error) {
      console.error('Dataset creation failed:', error)
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to create dataset',
        code: 'CREATION_ERROR',
      }
    }
  },
})

export const remove = mutation({
  args: {
    id: v.id('datasets'),
  },
  handler: async (ctx, { id }) => {
    const dataset = await ctx.db.get(id)
    if (!dataset) throw new Error('Dataset not found')

    const user = await safeGetUser(ctx)
    if (!user) throw new Error('Not authenticated')

    if (!dataset.dashboardId) {
      throw new Error('Not authorized')
    }

    const exists = await checkDashboardExists(ctx, dataset.dashboardId)
    if (!exists) {
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

    // Validate file size (500MB limit)
    const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
    if (fileSizeBytes > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 500MB limit')
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
