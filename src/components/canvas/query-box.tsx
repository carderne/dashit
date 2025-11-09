import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { AlertCircle, BarChart3, Play, Table as TableIcon, Trash2 } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useDuckDB } from '../../hooks/useDuckDB'
import type { BoxUpdate } from '../../types/box'

interface QueryBoxData {
  box: {
    _id: Id<'boxes'>
    content?: string
    title?: string
    positionX: number
    positionY: number
    height: number
  }
  dashboardId: Id<'dashboards'>
  onUpdate: (boxId: Id<'boxes'>, updates: BoxUpdate) => void
  onDelete: (boxId: Id<'boxes'>) => void
  onCreateConnectedBox?: (
    sourceBoxId: Id<'boxes'>,
    type: 'table' | 'chart',
    position: { x: number; y: number },
  ) => void
}

function QueryBoxComponent({ data }: NodeProps) {
  const { box, onUpdate, onDelete, onCreateConnectedBox } = data as unknown as QueryBoxData
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get available datasets
  const { data: datasets = [] } = useQuery(convexQuery(api.datasets.list, {}))

  // Get DuckDB instance
  const { executeQuery, loadParquetFromURL, isLoading: duckdbLoading } = useDuckDB()

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

      // Load all available datasets into DuckDB
      for (const dataset of datasets) {
        if (dataset.downloadUrl) {
          // Dataset in R2 - load from URL
          await loadParquetFromURL(dataset.downloadUrl, dataset.name)
        }
      }

      // Execute the query
      const startTime = performance.now()
      const result = await executeQuery(query)
      const executionTime = performance.now() - startTime

      // Convert BigInt values to strings for JSON serialization
      const serializableRows = result.rows.map((row) =>
        row.map((value) => (typeof value === 'bigint' ? value.toString() : value)),
      )

      // Limit stored rows to prevent Convex size limits (1 MiB per document)
      // Store max 1000 rows, but keep full results in memory for display
      const MAX_STORED_ROWS = 1000
      const storedRows = serializableRows.slice(0, MAX_STORED_ROWS)
      const totalRows = serializableRows.length

      // Update with results (limited for storage)
      onUpdate(box._id, {
        results: JSON.stringify({
          columns: result.columns,
          rows: storedRows,
          executionTime,
          totalRows,
          truncated: totalRows > MAX_STORED_ROWS,
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

  const handleCreateTable = useCallback(() => {
    if (!onCreateConnectedBox) return
    // Create table to the right of the query box
    const position = {
      x: box.positionX + 450, // Query box width (400) + gap (50)
      y: box.positionY,
    }
    onCreateConnectedBox(box._id, 'table', position)
  }, [box._id, box.positionX, box.positionY, onCreateConnectedBox])

  const handleCreateChart = useCallback(() => {
    if (!onCreateConnectedBox) return
    // Create chart below the query box
    const position = {
      x: box.positionX,
      y: box.positionY + box.height + 50, // Query box height + gap
    }
    onCreateConnectedBox(box._id, 'chart', position)
  }, [box._id, box.positionX, box.positionY, box.height, onCreateConnectedBox])

  return (
    <Card className="h-full w-full shadow-lg">
      <Handle type="target" position={Position.Top} />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{box.title || 'SQL Query'}</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateTable}
              disabled={!onCreateConnectedBox}
              title="Create connected table"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateChart}
              disabled={!onCreateConnectedBox}
              title="Create connected chart"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
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
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
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

export const QueryBox = memo(QueryBoxComponent)
