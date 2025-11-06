import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { AlertCircle, Play, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useDuckDB } from '../../hooks/useDuckDB'
import type { BoxUpdate } from '../../types/box'
import { getDatasetFromIndexedDB } from '../../utils/indexeddb'

interface QueryBoxData {
  box: {
    _id: Id<'boxes'>
    content?: string
    title?: string
  }
  dashboardId: Id<'dashboards'>
  onUpdate: (boxId: Id<'boxes'>, updates: BoxUpdate) => void
  onDelete: (boxId: Id<'boxes'>) => void
}

export function QueryBox({ data }: NodeProps) {
  const { box, onUpdate, onDelete } = data as unknown as QueryBoxData
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get session ID for guest users
  const [sessionId] = useState(() => {
    const existing = localStorage.getItem('dashit_session_id')
    if (existing) return existing
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem('dashit_session_id', newId)
    return newId
  })

  // Get available datasets
  const { data: datasets = [] } = useQuery(convexQuery(api.datasets.list, { sessionId }))

  // Get DuckDB instance
  const {
    executeQuery,
    loadParquetFromURL,
    loadParquetFromBuffer,
    isLoading: duckdbLoading,
  } = useDuckDB()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Enter your SQL query here...',
      }),
    ],
    content: box.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
    onUpdate: ({ editor: editorInstance }) => {
      const content = editorInstance.getHTML()
      // Debounce the update
      onUpdate(box._id, { content })
    },
  })

  const handleExecute = useCallback(async () => {
    if (duckdbLoading) return

    setIsExecuting(true)
    setError(null)

    try {
      const query = editor.getText().trim()
      if (!query) {
        throw new Error('Query is empty')
      }

      console.log('Executing query:', query)
      console.log('Available datasets:', datasets)

      // Load all available datasets into DuckDB
      for (const dataset of datasets) {
        if (dataset.downloadUrl) {
          // Dataset in R2 - load from URL
          console.log(`Loading dataset ${dataset.name} from R2:`, dataset.downloadUrl)
          await loadParquetFromURL(dataset.downloadUrl, dataset.name)
        } else if (dataset.sessionId) {
          // In-memory dataset - load from IndexedDB
          console.log(`Loading dataset ${dataset.name} from IndexedDB`)
          const buffer = await getDatasetFromIndexedDB(dataset.name, dataset.sessionId)
          if (buffer) {
            await loadParquetFromBuffer(buffer, dataset.name)
          } else {
            console.warn(`Dataset ${dataset.name} not found in IndexedDB`)
          }
        }
      }

      // Execute the query
      const startTime = performance.now()
      const result = await executeQuery(query)
      const executionTime = performance.now() - startTime

      console.log('Query executed successfully:', result)
      console.log(`Execution time: ${executionTime.toFixed(2)}ms`)

      // Update with results
      onUpdate(box._id, {
        results: JSON.stringify({
          columns: result.columns,
          rows: result.rows,
          executionTime,
        }),
      })
    } catch (err) {
      console.error('Query execution failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Query execution failed'
      setError(errorMessage)
      onUpdate(box._id, {
        results: JSON.stringify({
          error: errorMessage,
          columns: [],
          rows: [],
        }),
      })
    } finally {
      setIsExecuting(false)
    }
  }, [editor, box._id, onUpdate, datasets, executeQuery, loadParquetFromURL, duckdbLoading])

  const handleDelete = useCallback(() => {
    onDelete(box._id)
  }, [box._id, onDelete])

  return (
    <Card className="h-full w-full shadow-lg">
      <Handle type="target" position={Position.Top} />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{box.title || 'SQL Query'}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={handleExecute} disabled={isExecuting}>
              <Play className="mr-1 h-4 w-4" />
              {isExecuting ? 'Running...' : 'Execute'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="bg-background rounded-md border">
          <EditorContent editor={editor} />
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {datasets.length === 0 && (
          <div className="mt-3 text-xs text-gray-500">
            No datasets available. Upload data to start querying.
          </div>
        )}
      </CardContent>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}
