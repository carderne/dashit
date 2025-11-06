import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { File, Globe, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { Dataset } from '../types/dataset'
import { Button } from './ui/button'
import { Card } from './ui/card'

interface DatasetPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function DatasetPanel({ isOpen, onClose }: DatasetPanelProps) {
  const [sessionId] = useState(() => {
    // Get or create session ID from localStorage
    const existing = localStorage.getItem('dashit_session_id')
    if (existing) return existing
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem('dashit_session_id', newId)
    return newId
  })

  const { data: datasets = [], isLoading } = useQuery(convexQuery(api.datasets.list, { sessionId }))

  const deleteDataset = useConvexMutation(api.datasets.remove)

  const handleDelete = async (datasetId: Id<'datasets'>) => {
    if (confirm('Are you sure you want to delete this dataset?')) {
      await deleteDataset({ id: datasetId, sessionId })
    }
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
    <Card className="absolute top-4 right-4 z-10 flex max-h-[calc(100vh-2rem)] w-80 flex-col shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-white">Datasets</h2>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Dataset List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading datasets...</p>
        ) : datasets.length === 0 ? (
          <div className="py-8 text-center">
            <File className="mx-auto mb-2 h-12 w-12 text-gray-600" />
            <p className="text-sm text-gray-400">No datasets yet</p>
            <p className="mt-1 text-xs text-gray-500">Click "Upload" to add data</p>
          </div>
        ) : (
          <div className="space-y-2">
            {datasets.map((dataset: Dataset) => (
              <div
                key={dataset._id}
                className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 transition-colors hover:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 flex-shrink-0 text-blue-400" />
                      <h3 className="truncate text-sm font-medium text-white">{dataset.name}</h3>
                      {dataset.isPublic && (
                        <Globe className="h-3 w-3 flex-shrink-0 text-green-400" />
                      )}
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
