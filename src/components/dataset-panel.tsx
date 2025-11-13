import { cn } from '@/lib/utils'
import { convexQuery, useConvexAction, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCustomer } from 'autumn-js/react'
import { File as FileIcon, Globe, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useDuckDB } from '../hooks/useDuckDB'
import type { Dataset } from '../types/dataset'
import { Button } from './ui/button'
import { Card } from './ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Progress } from './ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface DatasetPanelProps {
  isOpen: boolean
  onClose: () => void
  dashboardId: Id<'dashboards'> // Required: all datasets belong to a dashboard
}

interface UploadingDataset {
  id: string
  name: string
  fileName: string
  progress: number
  error?: string
  fadeOut?: boolean
}

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

export function DatasetPanel({ isOpen, onClose, dashboardId }: DatasetPanelProps) {
  const [uploadingDatasets, setUploadingDatasets] = useState<Array<UploadingDataset>>([])
  const [isDragging, setIsDragging] = useState(false)
  const [hasUploadQuota, setHasUploadQuota] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [datasetToDelete, setDatasetToDelete] = useState<{
    id: Id<'datasets'>
    name: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()
  const { check } = useCustomer()
  const { convertCSVToParquet } = useDuckDB()
  const generateUploadUrl = useConvexMutation(api.datasets.generateUploadUrl)
  const createDataset = useConvexAction(api.datasets.create)
  // Use datasets.list which requires dashboardId
  const { data: datasets = [], isLoading } = useQuery(
    convexQuery(api.datasets.list, { dashboardId }),
  )
  const { data: user } = useQuery(convexQuery(api.auth.getCurrentUser, {}))

  const deleteDataset = useConvexMutation(api.datasets.remove)

  const handleDeleteClick = (datasetId: Id<'datasets'>, datasetName: string) => {
    setDatasetToDelete({ id: datasetId, name: datasetName })
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!datasetToDelete) return

    try {
      await deleteDataset({ id: datasetToDelete.id })
      toast.success('Dataset deleted', {
        description: `${datasetToDelete.name} has been deleted`,
      })
    } catch (error) {
      toast.error('Failed to delete dataset', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setDeleteDialogOpen(false)
      setDatasetToDelete(null)
    }
  }

  // Check upload quota
  useEffect(() => {
    const checkQuota = () => {
      const result = check({ featureId: 'file_upload' })
      // Autumn's check returns a Success<CheckResult> type with data property
      setHasUploadQuota((result as { data?: { allowed?: boolean } }).data?.allowed ?? true)
    }
    checkQuota()
  }, [check])

  // Handle file upload
  const uploadFile = async (file: File) => {
    const uploadId = `upload-${Date.now()}-${Math.random()}`
    const nameWithoutExtension = file.name.substring(0, file.name.lastIndexOf('.'))

    // Add optimistic upload entry
    const optimisticDataset: UploadingDataset = {
      id: uploadId,
      name: nameWithoutExtension,
      fileName: file.name,
      progress: 0,
    }
    setUploadingDatasets((prev) => [...prev, optimisticDataset])

    try {
      // Validate file type
      const validTypes = ['.csv', '.parquet']
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
      if (!validTypes.includes(fileExtension)) {
        throw new Error('Please select a CSV or Parquet file')
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 500MB limit')
      }

      let fileToUpload = file
      let fileName = file.name

      // Convert CSV to Parquet if needed
      if (file.name.toLowerCase().endsWith('.csv')) {
        setUploadingDatasets((prev) =>
          prev.map((d) => (d.id === uploadId ? { ...d, progress: 10 } : d)),
        )
        fileName = file.name.replace(/\.csv$/i, '.parquet')
        const parquetBuffer = await convertCSVToParquet(file)
        fileToUpload = new File([parquetBuffer], fileName, { type: 'application/octet-stream' })
      }

      setUploadingDatasets((prev) =>
        prev.map((d) => (d.id === uploadId ? { ...d, progress: 20 } : d)),
      )

      const { uploadUrl, r2Key } = await generateUploadUrl({
        fileName,
        fileSizeBytes: fileToUpload.size,
      })

      // Upload to R2 with progress tracking
      setUploadingDatasets((prev) =>
        prev.map((d) => (d.id === uploadId ? { ...d, progress: 30 } : d)),
      )

      const xhr = new XMLHttpRequest()

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentage = 30 + (e.loaded / e.total) * 60
            setUploadingDatasets((prev) =>
              prev.map((d) => (d.id === uploadId ? { ...d, progress: percentage } : d)),
            )
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', 'application/octet-stream')
        xhr.send(fileToUpload)
      })

      // Create dataset record in Convex
      setUploadingDatasets((prev) =>
        prev.map((d) => (d.id === uploadId ? { ...d, progress: 95 } : d)),
      )

      const result = await createDataset({
        name: nameWithoutExtension,
        fileName,
        r2Key,
        fileSizeBytes: fileToUpload.size,
        dashboardId,
      })

      if (!result.ok) {
        // Handle error result
        const errorMessage =
          result.code === 'QUOTA_EXCEEDED'
            ? "You've used up your upload quota, upgrade for more"
            : result.message

        setUploadingDatasets((prev) =>
          prev.map((d) => (d.id === uploadId ? { ...d, error: errorMessage, progress: 0 } : d)),
        )

        // Schedule fade-out after 10 seconds
        setTimeout(() => {
          setUploadingDatasets((prev) =>
            prev.map((d) => (d.id === uploadId ? { ...d, fadeOut: true } : d)),
          )
          // Remove after fade animation (500ms)
          setTimeout(() => {
            setUploadingDatasets((prev) => prev.filter((d) => d.id !== uploadId))
          }, 500)
        }, 10000)

        // Update quota state if quota error
        if (result.code === 'QUOTA_EXCEEDED') {
          setHasUploadQuota(false)
        }

        return // Don't remove from list immediately, let it fade out
      }

      // Remove from uploading list immediately - the real dataset will now appear
      setUploadingDatasets((prev) => prev.filter((d) => d.id !== uploadId))
    } catch (error) {
      // Show error in the optimistic entry
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setUploadingDatasets((prev) =>
        prev.map((d) => (d.id === uploadId ? { ...d, error: errorMessage, progress: 0 } : d)),
      )

      // Schedule fade-out after 10 seconds for any error
      setTimeout(() => {
        setUploadingDatasets((prev) =>
          prev.map((d) => (d.id === uploadId ? { ...d, fadeOut: true } : d)),
        )
        // Remove after fade animation (500ms)
        setTimeout(() => {
          setUploadingDatasets((prev) => prev.filter((d) => d.id !== uploadId))
        }, 500)
      }, 10000)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    // Check quota before starting uploads
    const quotaCheck = check({ featureId: 'file_upload' })
    // Autumn's check returns a Success<CheckResult> type with data property
    const allowed = (quotaCheck as { data?: { allowed?: boolean } }).data?.allowed ?? true
    if (!allowed) {
      toast.error('Upload Limit Reached', {
        description: "You've used up your upload quota, upgrade for more",
        action: {
          label: 'Upgrade Now',
          onClick: () => navigate({ to: '/upgrade' }),
        },
      })
      setHasUploadQuota(false)
      return
    }

    // Upload files
    Array.from(files).forEach((file) => {
      uploadFile(file)
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.endsWith('.csv') || file.name.endsWith('.parquet'),
    )

    files.forEach((file) => {
      uploadFile(file)
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (!isOpen) return null

  return (
    <Card
      className={cn(
        'absolute top-4 right-4 z-10 flex max-h-[calc(100vh-2rem)] w-80 flex-col gap-2 p-0 shadow-lg',
        isDragging ? 'ring-2 ring-blue-500' : '',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.parquet"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col border-b border-gray-700 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-foreground text-lg font-semibold">Datasets</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn(!user && '[box-shadow:0_0_12px_rgba(245,158,11,0.6)]')}
          onClick={
            !user
              ? () => navigate({ to: '/sign-up' })
              : !hasUploadQuota
                ? () => navigate({ to: '/upgrade' })
                : handleUploadClick
          }
        >
          <Upload className="mr-2 h-4 w-4" />
          {!user ? 'Sign Up to Upload' : !hasUploadQuota ? 'Upgrade to Upload' : 'Upload'}
        </Button>
      </div>

      {/* Dataset List */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading datasets...</p>
        ) : datasets.length === 0 && uploadingDatasets.length === 0 ? (
          <div className="text-center">
            <FileIcon className="mx-auto mb-2 h-12 w-12 text-gray-600" />
            <p className="text-sm text-gray-400">No datasets yet</p>
            <p className="mt-1 text-xs text-gray-500">Click "Upload" or drag & drop CSV files</p>
          </div>
        ) : (
          <Tabs defaultValue="yours" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="yours">
                Current ({datasets.filter((d: Dataset) => !d.isPublic).length})
              </TabsTrigger>
              <TabsTrigger value="public">
                Public ({datasets.filter((d: Dataset) => d.isPublic).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="yours" className="mt-4">
              <div className="space-y-2">
                {/* Show uploading datasets first */}
                {uploadingDatasets.map((upload) => (
                  <div
                    key={upload.id}
                    className={`rounded-lg border border-blue-500/50 bg-blue-500/10 p-3 transition-opacity duration-500 ${
                      upload.fadeOut ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Upload className="h-4 w-4 shrink-0 animate-pulse text-blue-400" />
                          <h3 className="truncate text-sm font-medium text-white">{upload.name}</h3>
                        </div>
                        <p className="mt-1 truncate text-xs text-gray-400">{upload.fileName}</p>
                        {upload.error ? (
                          <p className="mt-2 text-xs text-red-400">{upload.error}</p>
                        ) : (
                          <div className="mt-2">
                            <Progress value={upload.progress} max={100} className="h-1" />
                            <p className="mt-1 text-xs text-gray-400">
                              {Math.round(upload.progress)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show user's datasets (but hide ones that are currently uploading) */}
                {datasets
                  .filter(
                    (dataset: Dataset) =>
                      !dataset.isPublic &&
                      !uploadingDatasets.some((upload) => upload.name === dataset.name),
                  )
                  .map((dataset: Dataset) => (
                    <div
                      key={dataset._id}
                      className="rounded-lg border border-gray-700 p-3 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileIcon className="h-4 w-4 shrink-0 text-blue-400" />
                            <h3 className="text-foreground truncate text-sm font-medium">
                              {dataset.name}
                            </h3>
                          </div>
                          <p className="mt-1 truncate text-xs text-gray-400">{dataset.fileName}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            <span>{formatFileSize(dataset.fileSizeBytes)}</span>
                            <span>•</span>
                            <span>{formatDate(dataset.createdAt)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(dataset._id, dataset.name)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                {datasets.filter((d: Dataset) => !d.isPublic && d.userId === user?._id).length ===
                  0 &&
                  uploadingDatasets.length === 0 && (
                    <div className="py-8 text-center">
                      <FileIcon className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                      <p className="text-sm text-gray-400">No personal datasets yet</p>
                    </div>
                  )}
              </div>
            </TabsContent>

            <TabsContent value="public" className="mt-4">
              <div className="space-y-2">
                {datasets
                  .filter((dataset: Dataset) => dataset.isPublic)
                  .map((dataset: Dataset) => (
                    <div
                      key={dataset._id}
                      className="rounded-lg border border-gray-700 p-3 transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileIcon className="h-4 w-4 shrink-0 text-blue-400" />
                            <h3 className="text-foreground truncate text-sm font-medium">
                              {dataset.name}
                            </h3>
                            <Globe className="h-3 w-3 shrink-0 text-green-400" />
                          </div>
                          <p className="mt-1 truncate text-xs text-gray-400">{dataset.fileName}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            <span>{formatFileSize(dataset.fileSizeBytes)}</span>
                            <span>•</span>
                            <span>{formatDate(dataset.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                {datasets.filter((d: Dataset) => d.isPublic).length === 0 && (
                  <div className="py-8 text-center">
                    <Globe className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                    <p className="text-sm text-gray-400">No public datasets available</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-gray-700 p-3 text-xs text-gray-500">
        <p>Reference datasets in SQL queries by name:</p>
        <code className="mt-1 block rounded bg-gray-800 px-2 py-1 text-gray-300">
          SELECT * FROM {datasets[0]?.name || 'dataset_name'}
        </code>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Dataset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="text-foreground font-semibold">{datasetToDelete?.name}</span>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
