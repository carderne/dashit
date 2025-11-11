import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { File as FileIcon, Globe, Trash2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useDuckDB } from '../hooks/useDuckDB'
import type { Dataset } from '../types/dataset'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Progress } from './ui/progress'

interface DatasetPanelProps {
  isOpen: boolean
  onClose: () => void
  dashboardId?: Id<'dashboards'> // Optional: filter to dashboard datasets
}

interface UploadingDataset {
  id: string
  name: string
  fileName: string
  progress: number
  error?: string
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export function DatasetPanel({ isOpen, onClose, dashboardId }: DatasetPanelProps) {
  const [uploadingDatasets, setUploadingDatasets] = useState<Array<UploadingDataset>>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { convertCSVToParquet } = useDuckDB()
  const generateUploadUrl = useConvexMutation(api.datasets.generateUploadUrl)
  const createDataset = useConvexMutation(api.datasets.create)
  // Use dashboard-specific query if dashboardId provided, otherwise use global list
  const { data: dashboardDatasets = [], isLoading: isDashboardLoading } = useQuery({
    ...convexQuery(api.datasets.listForDashboard, { dashboardId: dashboardId! }),
    enabled: !!dashboardId,
  })

  const { data: globalDatasets = [], isLoading: isGlobalLoading } = useQuery({
    ...convexQuery(api.datasets.list, {}),
    enabled: !dashboardId,
  })

  const datasets = dashboardId ? dashboardDatasets : globalDatasets
  const isLoading = dashboardId ? isDashboardLoading : isGlobalLoading

  const deleteDataset = useConvexMutation(api.datasets.remove)

  const handleDelete = async (datasetId: Id<'datasets'>) => {
    if (confirm('Are you sure you want to delete this dataset?')) {
      await deleteDataset({ id: datasetId })
    }
  }

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
        throw new Error('File size exceeds 100MB limit')
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

      await createDataset({
        name: nameWithoutExtension,
        fileName,
        r2Key,
        fileSizeBytes: fileToUpload.size,
        dashboardId,
      })

      // Remove from uploading list immediately - the real dataset will now appear
      setUploadingDatasets((prev) => prev.filter((d) => d.id !== uploadId))
    } catch (error) {
      // Show error in the optimistic entry
      setUploadingDatasets((prev) =>
        prev.map((d) =>
          d.id === uploadId
            ? { ...d, error: error instanceof Error ? error.message : 'Upload failed' }
            : d,
        ),
      )
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

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
      className={`absolute top-4 right-4 z-10 flex max-h-[calc(100vh-2rem)] w-80 flex-col shadow-lg ${
        isDragging ? 'ring-2 ring-blue-500' : ''
      }`}
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
      <div className="flex items-center justify-between border-b border-gray-700 p-4">
        <h2 className="text-foreground text-lg font-semibold">Datasets</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleUploadClick}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dataset List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading datasets...</p>
        ) : datasets.length === 0 && uploadingDatasets.length === 0 ? (
          <div className="py-8 text-center">
            <FileIcon className="mx-auto mb-2 h-12 w-12 text-gray-600" />
            <p className="text-sm text-gray-400">No datasets yet</p>
            <p className="mt-1 text-xs text-gray-500">Click "Upload" or drag & drop CSV files</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Show uploading datasets first */}
            {uploadingDatasets.map((upload) => (
              <div
                key={upload.id}
                className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3"
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
                        <p className="mt-1 text-xs text-gray-400">{Math.round(upload.progress)}%</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Show existing datasets (but hide ones that are currently uploading) */}
            {datasets
              .filter((dataset: Dataset) => {
                // Hide dataset if it's currently being uploaded (match by name)
                return !uploadingDatasets.some((upload) => upload.name === dataset.name)
              })
              .map((dataset: Dataset) => (
                <div
                  key={dataset._id}
                  className="rounded-lg border border-gray-700 p-3 transition-colors hover:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 shrink-0 text-blue-400" />
                        <h3 className="truncate text-sm font-medium text-white">{dataset.name}</h3>
                        {dataset.isPublic && <Globe className="h-3 w-3 shrink-0 text-green-400" />}
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-400">{dataset.fileName}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatFileSize(dataset.fileSizeBytes)}</span>
                        <span>•</span>
                        <span>{formatDate(dataset.createdAt)}</span>
                      </div>
                    </div>
                    {!dataset.isPublic && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(dataset._id)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-gray-700 p-3 text-xs text-gray-500">
        <p>Reference datasets in SQL queries by name:</p>
        <code className="mt-1 block rounded bg-gray-800 px-2 py-1 text-gray-300">
          SELECT * FROM {datasets[0]?.name || 'dataset_name'}
        </code>
      </div>
    </Card>
  )
}
