import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { convexQuery, useConvexAction } from '@convex-dev/react-query'
import { useQuery as useTanStackQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { useCustomer } from 'autumn-js/react'
import { useMutation, useQuery } from 'convex/react'
import { BarChart3, Play, Sparkles, Table as TableIcon, Trash2 } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useDuckDB } from '../../hooks/useDuckDB'
import type { Box, BoxUpdate } from '../../types/box'
import { EditableTitle } from './editable-title'
import { SQLEditor } from './sql-editor'

interface QueryBoxData {
  box: {
    _id: Id<'boxes'>
    //   content?: string
    //   lastRunContent?: string
    //   editedAt?: number
    //   runAt?: number
    //   title?: string
    // positionX: number
    // positionY: number
    // height: number
  }
  dashboardId: Id<'dashboards'>
  sessionId?: string
  shareKey?: string
  onUpdate: (boxId: Id<'boxes'>, updates: BoxUpdate) => void
  onDelete: (boxId: Id<'boxes'>) => void
  onCreateConnectedBox?: (
    sourceBoxId: Id<'boxes'>,
    type: 'table' | 'chart',
    position: { x: number; y: number },
  ) => void
  boxes?: Array<Box>
}

function QueryBoxComponent({ data }: NodeProps) {
  const {
    box: { _id: boxId },
    dashboardId,
    sessionId,
    shareKey,
    boxes,
    onUpdate,
    onDelete,
    onCreateConnectedBox,
  } = data as unknown as QueryBoxData
  const [isExecuting, setIsExecuting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasAIQuota, setHasAIQuota] = useState(true)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()
  const user = useQuery(api.auth.getCurrentUser, {})
  const { check } = useCustomer()

  const generateSQL = useConvexAction(api.llm.generateSQL)

  const datasets = useQuery(api.datasets.list, { dashboardId, sessionId, key: shareKey }) ?? []
  const { data: box } = useTanStackQuery(convexQuery(api.boxes.getContentMinimal, { id: boxId }))

  const update = useMutation(api.boxes.updateContentMinimal).withOptimisticUpdate(
    (localStore, { id, content: newContent }) => {
      const current = localStore.getQuery(api.boxes.getContentMinimal, { id })
      if (current) {
        localStore.setQuery(
          api.boxes.getContentMinimal,
          { id },
          { ...current, content: newContent ?? '' },
        )
      }
    },
  )

  const {
    executeQuery,
    loadParquetFromURL,
    loadQueryResults,
    isLoading: duckdbLoading,
  } = useDuckDB()

  const handleContentChange = (value: string) => {
    update({ id: boxId, content: value })
  }

  // Check AI generation quota
  useEffect(() => {
    const checkQuota = () => {
      const result = check({ featureId: 'ai_generation' })
      // Autumn's check returns a Success<CheckResult> type with data property
      setHasAIQuota((result as { data?: { allowed?: boolean } }).data?.allowed ?? true)
    }
    checkQuota()
  }, [check])

  const handleExecute = async () => {
    if (duckdbLoading) return
    if (!box || box.content === undefined) return

    setIsExecuting(true)

    try {
      const query = box.content.trim()
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

      // Load all named query results as tables (for chaining queries)
      if (boxes) {
        for (const queryBox of boxes) {
          // Only load query boxes with custom titles and results
          if (queryBox.type === 'query' && queryBox.title && queryBox.results) {
            try {
              await loadQueryResults(queryBox.title, queryBox.results)
            } catch (err) {
              console.error(`Failed to load query results for "${queryBox.title}":`, err)
              // Continue loading other queries even if one fails
            }
          }
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
      onUpdate(boxId, {
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
      onUpdate(boxId, {
        results: JSON.stringify({
          error: errorMessage,
          columns: [],
          rows: [],
        }),
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleDelete = () => {
    onDelete(boxId)
  }

  const handleCreateTable = () => {
    if (!onCreateConnectedBox || !box) return
    // Create table to the right of the query box
    const position = {
      x: box.positionX + 450, // Query box width (400) + gap (50)
      y: box.positionY,
    }
    onCreateConnectedBox(box._id, 'table', position)
  }

  const handleCreateChart = () => {
    if (!onCreateConnectedBox || !box) return
    // Create chart below the query box
    const position = {
      x: box.positionX,
      y: box.positionY + box.height + 50, // Query box height + gap
    }
    onCreateConnectedBox(box._id, 'chart', position)
  }

  const handleGenerate = async () => {
    if (!box || box.content === undefined) {
      return
    }
    setIsGenerating(true)
    try {
      // Use current content as prompt
      const result = await generateSQL({
        prompt: box.content,
        dashboardId,
      })

      if (!result.ok) {
        // Handle error result
        if (result.code === 'QUOTA_EXCEEDED') {
          toast.error('AI Generation Limit Reached', {
            description: result.message,
            action: {
              label: 'Upgrade Now',
              onClick: () => navigate({ to: '/upgrade' }),
            },
          })
          // Update quota state to reflect the limit
          setHasAIQuota(false)
        } else {
          toast.error('Generation Failed', {
            description: result.message,
          })
        }
        return
      }

      // Update the editor content with generated SQL
      handleContentChange(result.data)

      toast.success('SQL Generated', {
        description: 'Your query has been generated successfully',
      })
    } catch (err) {
      console.error('SQL generation failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate SQL'
      toast.error('Generation Failed', {
        description: errorMessage,
      })
    } finally {
      setIsGenerating(false)
    }
  }

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

    const editorElement = editorContainerRef.current
    if (!editorElement) return

    editorElement.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [handleExecute])

  // Guard: Wait for box data to load
  if (!box) {
    return null
  }

  // Determine query status: 'never-run' | 'in-sync' | 'changed'
  const queryStatus = !box.runAt
    ? 'never-run'
    : !box.editedAt
      ? 'in-sync'
      : box.editedAt > box.runAt
        ? 'changed'
        : 'in-sync'

  return (
    <Card
      className={cn(
        'flex h-full w-full flex-col shadow-lg transition-all',
        queryStatus === 'in-sync' && '[box-shadow:0_0_12px_rgba(34,197,94,0.6)]',
        queryStatus === 'changed' && '[box-shadow:0_0_12px_rgba(245,158,11,0.6)]',
      )}
    >
      <Handle type="target" position={Position.Top} />

      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EditableTitle
            boxId={box._id}
            dashboardId={dashboardId}
            title={box.title}
            defaultTitle="SQL Query"
            onUpdate={onUpdate}
          />
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

      <CardContent className="nodrag relative flex min-h-0 flex-1 flex-col">
        <div
          ref={editorContainerRef}
          className="nodrag nowheel min-h-0 flex-1"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <SQLEditor
            value={box.content ?? ''}
            onChange={handleContentChange}
            placeholder="Enter your SQL query here..."
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={
            !user
              ? () => navigate({ to: '/sign-up' })
              : !hasAIQuota
                ? () => navigate({ to: '/upgrade' })
                : handleGenerate
          }
          disabled={isGenerating || datasets.length === 0}
          className="nodrag absolute right-2 bottom-2"
        >
          <Sparkles className="mr-1 h-3 w-3" />
          {isGenerating
            ? 'Generating...'
            : !user
              ? 'Sign Up for AI'
              : !hasAIQuota
                ? 'Upgrade to Generate'
                : 'Generate'}
        </Button>
      </CardContent>

      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}

export const QueryBox = memo(QueryBoxComponent)
