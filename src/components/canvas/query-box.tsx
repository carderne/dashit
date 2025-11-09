import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { convexQuery } from '@convex-dev/react-query'
import { debounce } from '@tanstack/pacer'
import { useQuery } from '@tanstack/react-query'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { BarChart3, Play, Table as TableIcon, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useDuckDB } from '../../hooks/useDuckDB'
import type { BoxUpdate } from '../../types/box'

interface QueryBoxData {
  box: {
    _id: Id<'boxes'>
    content?: string
    lastRunContent?: string
    editedAt?: number
    runAt?: number
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
  const [fontSize, setFontSize] = useState(14) // Start with prose-sm equivalent (14px)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Debounced update for editedAt timestamp using TanStack Pacer
  const updateEditedAt = useMemo(
    () =>
      debounce(() => {
        onUpdate(box._id, { editedAt: Date.now() })
      }, { wait: 500 }),
    [box._id, onUpdate]
  )

  // Get available datasets
  const { data: datasets = [] } = useQuery(convexQuery(api.datasets.list, {}))

  // Get DuckDB instance
  const { executeQuery, loadParquetFromURL, isLoading: duckdbLoading } = useDuckDB()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // History extension is included in StarterKit by default
        // It provides undo/redo with CMD-Z and Shift-CMD-Z (or Ctrl-Z / Shift-Ctrl-Z on Windows)
      }),
      Placeholder.configure({
        placeholder: 'Enter your SQL query here...',
      }),
    ],
    content: box.content || '',
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4',
        style: `font-size: ${fontSize}px;`,
      },
    },
    onUpdate: ({ editor: editorInstance }) => {
      const content = editorInstance.getHTML()
      onUpdate(box._id, { content })
      updateEditedAt() // Update editedAt timestamp (debounced)
    },
  })

  // Dynamically adjust font size based on content overflow
  useEffect(() => {
    if (!editorContainerRef.current) return

    const checkOverflow = () => {
      const container = editorContainerRef.current
      if (!container) return

      const editorElement = container.querySelector('.ProseMirror') as HTMLElement

      const containerHeight = container.clientHeight
      const contentHeight = editorElement.scrollHeight

      // If content overflows, reduce font size
      if (contentHeight > containerHeight && fontSize > 10) {
        setFontSize((prev) => Math.max(10, prev - 1))
      }
      // If content has plenty of room and font is small, increase it
      else if (contentHeight < containerHeight * 0.7 && fontSize < 14) {
        setFontSize((prev) => Math.min(14, prev + 1))
      }
    }

    // Check overflow on content update
    checkOverflow()

    // Also check when editor updates
    const handleUpdate = () => {
      setTimeout(checkOverflow, 0)
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, fontSize])

  // Update editor font size when fontSize state changes
  useEffect(() => {
    editor.view.dom.setAttribute('style', `font-size: ${fontSize}px;`)
  }, [editor, fontSize])

  const handleExecute = useCallback(async () => {
    if (duckdbLoading) return

    setIsExecuting(true)

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

      // Update with results (limited for storage) and set runAt
      onUpdate(box._id, {
        results: JSON.stringify({
          columns: result.columns,
          rows: storedRows,
          executionTime,
          totalRows,
          truncated: totalRows > MAX_STORED_ROWS,
        }),
        runAt: Date.now(),
      })
    } catch (err) {
      console.error('Query execution failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Query execution failed'
      toast.error('Query Execution Failed', {
        description: errorMessage,
      })
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

  // Determine query status: 'never-run' | 'in-sync' | 'changed'
  const queryStatus = useMemo(() => {
    if (!box.runAt) return 'never-run'
    if (!box.editedAt) return 'in-sync' // Never edited, so must be in sync
    return box.editedAt > box.runAt ? 'changed' : 'in-sync'
  }, [box.editedAt, box.runAt])

  // Add CMD-Enter keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        handleExecute()
        return false
      }
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [editor, handleExecute])

  return (
    <Card className="h-full w-full shadow-lg transition-all">
      <Handle type="target" position={Position.Top} />

      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">{box.title || 'SQL Query'}</CardTitle>
          {queryStatus === 'in-sync' && (
            <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">In sync</span>
            </div>
          )}
          {queryStatus === 'changed' && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-xs text-amber-600 dark:text-amber-400">Modified</span>
            </div>
          )}
        </div>
        <div className="nodrag flex gap-2">
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
      </CardHeader>

      <CardContent className="nodrag">
        <div
          ref={editorContainerRef}
          className="bg-background nodrag cursor-text overflow-hidden rounded-md border"
          style={{ height: '200px' }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <EditorContent editor={editor} />
        </div>
      </CardContent>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}

export const QueryBox = memo(QueryBoxComponent)
