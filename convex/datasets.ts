import { v } from 'convex/values'
import { api } from './_generated/api'
import { action, mutation, query } from './_generated/server'
import { safeGetUser } from './auth'
import { autumn } from './autumn'
import { checkDashboardAccess } from './dashboards'
import { generatePresignedDownloadUrl, generatePresignedUploadUrl } from './r2'
import type { Result } from './types'

export const list = query({
  args: {
    dashboardId: v.id('dashboards'),
    sessionId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  handler: async (ctx, { dashboardId, sessionId, key }) => {
    // Check access to dashboard
    await checkDashboardAccess(ctx, dashboardId, sessionId, key)

    const datasets = []

    // Get datasets linked to this dashboard via join table
    const datasetLinks = await ctx.db
      .query('datasetInDashboard')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .collect()

    // Fetch the actual dataset records
    for (const link of datasetLinks) {
      const dataset = await ctx.db.get(link.datasetId)
      if (dataset) {
        datasets.push(dataset)
      }
    }

    // Get public datasets
    const publicDatasets = await ctx.db
      .query('datasets')
      .withIndex('isPublic', (q) => q.eq('isPublic', true))
      .collect()
    datasets.push(...publicDatasets)

    // Remove duplicates (in case a dataset is both linked and public)
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
    isPublic: v.optional(v.boolean()),
    schema: v.optional(v.array(v.object({ name: v.string(), type: v.string() }))),
  },
  handler: async (ctx, args) => {
    const user = await safeGetUser(ctx)
    if (!user) {
      throw new Error('Must be authenticated to upload datasets')
    }

    const now = Date.now()
    const datasetId = await ctx.db.insert('datasets', {
      name: args.name,
      fileName: args.fileName,
      r2Key: args.r2Key,
      fileSizeBytes: args.fileSizeBytes,
      userId: user._id,
      isPublic: args.isPublic ?? false,
      schema: args.schema,
      createdAt: now,
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
    isPublic: v.optional(v.boolean()),
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

    // Check if user owns the dataset
    if (dataset.userId !== user._id) {
      throw new Error('Only dataset owner can delete it')
    }

    // Delete all join table records for this dataset
    const links = await ctx.db
      .query('datasetInDashboard')
      .withIndex('datasetId', (q) => q.eq('datasetId', id))
      .collect()

    for (const link of links) {
      await ctx.db.delete(link._id)
    }

    // Delete the dataset
    await ctx.db.delete(id)
  },
})

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

export const linkDatasetToDashboard = mutation({
  args: {
    datasetId: v.id('datasets'),
    dashboardId: v.id('dashboards'),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, { datasetId, dashboardId, sessionId }) => {
    // Verify dashboard ownership (only owner can link datasets)
    const access = await checkDashboardAccess(ctx, dashboardId, sessionId)
    if (!access.isOwner) {
      throw new Error('Only dashboard owner can add datasets')
    }

    // Verify dataset exists
    const dataset = await ctx.db.get(datasetId)
    if (!dataset) {
      throw new Error('Dataset not found')
    }

    // Check if link already exists
    const existingLink = await ctx.db
      .query('datasetInDashboard')
      .withIndex('dashboardId', (q) => q.eq('dashboardId', dashboardId))
      .filter((q) => q.eq(q.field('datasetId'), datasetId))
      .first()

    if (existingLink) {
      // Link already exists, just return
      return existingLink._id
    }

    // Create the link
    const linkId = await ctx.db.insert('datasetInDashboard', {
      datasetId,
      dashboardId,
    })

    return linkId
  },
})
