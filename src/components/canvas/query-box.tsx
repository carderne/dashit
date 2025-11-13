import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { convexQuery, useConvexAction } from '@convex-dev/react-query'
import { debounce } from '@tanstack/pacer'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { useCustomer } from 'autumn-js/react'
import { BarChart3, Play, Sparkles, Table as TableIcon, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  boxes?: Array<Box>
}

function QueryBoxComponent({ data }: NodeProps) {
  const { box, dashboardId, onUpdate, onDelete, onCreateConnectedBox, boxes } =
    data as unknown as QueryBoxData
  const [isExecuting, setIsExecuting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [content, setContent] = useState(box.content || '')
  const [hasAIQuota, setHasAIQuota] = useState(true)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Track the latest value from user input to prevent race condition with DB updates
  const latestUserInputRef = useRef(box.content || '')

  // Hooks for navigation, route context, and quota checking
  const navigate = useNavigate()
  const { data: user } = useQuery(convexQuery(api.auth.getCurrentUser, {}))
  const { check } = useCustomer()

  // LLM action for generating SQL
  const generateSQL = useConvexAction(api.llm.generateSQL)

  // Debounced update for editedAt timestamp using TanStack Pacer
  const updateEditedAt = useMemo(
    () =>
      debounce(
        () => {
          onUpdate(box._id, { editedAt: Date.now() })
        },
        { wait: 500 },
      ),
    [box._id, onUpdate],
  )

  // Get available datasets for this dashboard
  const { data: datasets = [] } = useQuery(
    convexQuery(api.datasets.listForDashboard, { dashboardId }),
  )

  // Get DuckDB instance
  const {
    executeQuery,
    loadParquetFromURL,
    loadQueryResults,
    isLoading: duckdbLoading,
  } = useDuckDB()

  // Handle content changes
  const handleContentChange = useCallback(
    (value: string) => {
      latestUserInputRef.current = value // Track latest user input
      setContent(value)
      onUpdate(box._id, { content: value })
      updateEditedAt()
    },
    [box._id, onUpdate, updateEditedAt],
  )

  // Sync content when box.content changes from EXTERNAL source only
  // This prevents race conditions where DB updates haven't completed yet
  useEffect(() => {
    if (
      box.content !== undefined &&
      box.content !== content &&
      box.content !== latestUserInputRef.current
    ) {
      // This is a real external change (e.g., from another user or undo/redo)
      setContent(box.content)
      latestUserInputRef.current = box.content
    }
  }, [box.content, content])

  // Check AI generation quota
  useEffect(() => {
    const checkQuota = async () => {
      const result = await check({ featureId: 'ai_generation' })
      // Autumn's check returns a Success<CheckResult> type with data property
      setHasAIQuota((result as { data?: { allowed?: boolean } }).data?.allowed ?? true)
    }
    checkQuota()
  }, [check])

  const handleExecute = useCallback(async () => {
    if (duckdbLoading) return

    setIsExecuting(true)

    try {
      const query = content.trim()
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
  }, [
    content,
    box._id,
    onUpdate,
    datasets,
    boxes,
    executeQuery,
    loadParquetFromURL,
    loadQueryResults,
    duckdbLoading,
  ])

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

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    try {
      // Use current content as prompt (can be empty)
      const result = await generateSQL({
        prompt: content,
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
  }, [content, dashboardId, generateSQL, handleContentChange, navigate])

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

    const editorElement = editorContainerRef.current
    if (!editorElement) return

    editorElement.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [handleExecute])

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
            value={content}
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
