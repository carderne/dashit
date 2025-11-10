import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, File as FileIcon, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useDuckDB } from '../hooks/useDuckDB'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Progress } from './ui/progress'

interface UploadDataModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId?: Id<'dashboards'> // Optional: link dataset to dashboard
  onUploadComplete?: () => void
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export function UploadDataModal({
  open,
  onOpenChange,
  dashboardId,
  onUploadComplete,
}: UploadDataModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { convertCSVToParquet } = useDuckDB()
  const generateUploadUrl = useConvexMutation(api.datasets.generateUploadUrl)
  const createDataset = useConvexMutation(api.datasets.create)

  // Get or create session ID for non-logged-in users
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate file type
    const validTypes = ['.csv', '.parquet']
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validTypes.includes(fileExtension)) {
      setError('Please select a CSV or Parquet file')
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds 100MB limit')
      return
    }

    setSelectedFile(file)
    // Auto-populate dataset name from filename
    const nameWithoutExtension = file.name.substring(0, file.name.lastIndexOf('.'))
    setDatasetName(nameWithoutExtension)
  }

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected')
      if (!datasetName.trim()) throw new Error('Please provide a dataset name')

      setIsUploading(true)
      setError(null)
      setUploadProgress(0)

      try {
        let fileToUpload = selectedFile
        let fileName = selectedFile.name

        // Convert CSV to Parquet if needed
        if (selectedFile.name.toLowerCase().endsWith('.csv')) {
          setUploadProgress(10)
          fileName = selectedFile.name.replace(/\.csv$/i, '.parquet')
          const parquetBuffer = await convertCSVToParquet(selectedFile)
          fileToUpload = new File([parquetBuffer], fileName)
        }

        setUploadProgress(20)
        const { uploadUrl, r2Key } = await generateUploadUrl({
          fileName,
          fileSizeBytes: fileToUpload.size,
        })

        // Upload to R2
        setUploadProgress(30)
        const xhr = new XMLHttpRequest()

        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              // Map upload progress to 30-90%
              const percentage = 30 + (e.loaded / e.total) * 60
              setUploadProgress(percentage)
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
        setUploadProgress(95)
        await createDataset({
          name: datasetName.trim(),
          fileName,
          r2Key,
          fileSizeBytes: fileToUpload.size,
          dashboardId, // Link to dashboard if provided
        })

        setUploadProgress(100)
        return true
      } finally {
        setIsUploading(false)
      }
    },
    onSuccess: () => {
      // Reset form
      setSelectedFile(null)
      setDatasetName('')
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Close modal and notify parent
      onOpenChange(false)
      onUploadComplete?.()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploadProgress(0)
    },
  })

  const handleUpload = () => {
    uploadMutation.mutate()
  }

  const handleCancel = () => {
    if (!isUploading) {
      setSelectedFile(null)
      setDatasetName('')
      setError(null)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Data</DialogTitle>
          <DialogDescription>
            Upload a CSV or Parquet file (max 100MB). CSV files will be converted to Parquet
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* File Selection */}
          <div className="grid gap-2">
            <Label htmlFor="file">File</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {selectedFile ? 'Change File' : 'Select File'}
              </Button>
              <input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".csv,.parquet"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <FileIcon className="h-4 w-4" />
                <span>{selectedFile.name}</span>
                <span>({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            )}
          </div>

          {/* Dataset Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Dataset Name</Label>
            <Input
              id="name"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="e.g., sales_data"
              disabled={isUploading}
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="grid gap-2">
              <Label>Upload Progress</Label>
              <Progress value={uploadProgress} max={100} />
              <p className="text-sm text-gray-400">{Math.round(uploadProgress)}%</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !datasetName.trim() || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
