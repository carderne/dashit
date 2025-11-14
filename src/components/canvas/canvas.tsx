import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import type { Connection, Edge, Node, NodeTypes, OnNodesChange } from '@xyflow/react'
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { getStroke } from 'perfect-freehand'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useCursorPresence } from '../../hooks/useCursorPresence'
import { useDuckDB } from '../../hooks/useDuckDB'
import type { Annotation, AnnotationUpdate } from '../../types/annotation'
import type { Box, BoxUpdate } from '../../types/box'
import { DatasetPanel } from '../dataset-panel'
import { ChartBox } from './chart-box'
import { CursorOverlay } from './cursor-overlay'
import { DashedBoxAnnotation } from './dashed-box-annotation'
import { DashedBoxTool } from './dashed-box-tool'
import { DrawingAnnotation } from './drawing-annotation'
import { QueryBox } from './query-box'
import { TableBox } from './table-box'
import { TextAnnotation } from './text-annotation'
import type { ToolType } from './top-nav'
import { TopNav } from './top-nav'

// Helper to convert stroke points to SVG path
function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length || !stroke[0]) return ''

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const next = arr[(i + 1) % arr.length]
      if (!next) return acc
      const [x1, y1] = next
      if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined) return acc
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q'] as Array<string | number>,
  )

  d.push('Z')
  return d.join(' ')
}

// Define custom node types
// TypeScript struggles with React Flow's NodeTypes, so we use type assertion here
const nodeTypes: NodeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: QueryBox as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: TableBox as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chart: ChartBox as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text: TextAnnotation as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'dashed-box': DashedBoxAnnotation as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drawing: DrawingAnnotation as any,
}

interface EdgeData {
  _id: string
  dashboardId: Id<'dashboards'>
  sourceBoxId: Id<'boxes'>
  targetBoxId: Id<'boxes'>
  createdAt: number
}

interface CanvasProps {
  dashboard: { _id: Id<'dashboards'>; userId?: Id<'users'> }
  boxes: Array<Box>
  edges: Array<EdgeData>
  annotations: Array<Annotation>
  sessionId?: string
  shareKey?: string
  onCreateBox: (type: 'query' | 'table' | 'chart', x: number, y: number) => void
  onUpdateBox: (boxId: Id<'boxes'>, updates: BoxUpdate) => void
  onDeleteBox: (boxId: Id<'boxes'>) => void
  onCreateConnectedBox?: (
    sourceBoxId: Id<'boxes'>,
    type: 'table' | 'chart',
    position: { x: number; y: number },
  ) => void
  onCreateEdge: (sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => void
  onDeleteEdge: (sourceBoxId: Id<'boxes'>, targetBoxId: Id<'boxes'>) => void
  onCreateAnnotation: (
    type: 'text' | 'dashed-box' | 'drawing',
    x: number,
    y: number,
    content?: string,
    width?: number,
    height?: number,
  ) => void
  onUpdateAnnotation: (annotationId: Id<'annotations'>, updates: AnnotationUpdate) => void
  onDeleteAnnotation: (annotationId: Id<'annotations'>) => void
}

function CanvasInner({
  dashboard,
  boxes,
  edges: edgeData,
  annotations,
  sessionId,
  shareKey,
  onCreateBox,
  onUpdateBox,
  onDeleteBox,
  onCreateConnectedBox,
  onCreateEdge,
  onDeleteEdge: _onDeleteEdge,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
}: CanvasProps) {
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null)
  const [datasetPanelOpen, setDatasetPanelOpen] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<number[][]>([]) // Flow coordinates for storage
  const [previewPoints, setPreviewPoints] = useState<number[][]>([]) // Screen coordinates for preview
  const [drawingStartPos, setDrawingStartPos] = useState<{ x: number; y: number } | null>(null)
  const { screenToFlowPosition } = useReactFlow()
  const { _id: dashboardId } = dashboard

  // Get current user for display name
  const { data: user } = useQuery(convexQuery(api.auth.getCurrentUser, {}))
  const displayName = user?.name || 'Anonymous'

  // Get datasets for query execution
  const { data: datasets = [] } = useQuery(
    convexQuery(api.datasets.list, { dashboardId, sessionId, key: shareKey }),
  )

  // DuckDB for query execution
  const {
    executeQuery,
    loadParquetFromURL,
    loadQueryResults,
    isLoading: duckdbLoading,
  } = useDuckDB()

  // Cursor presence for multiplayer
  const { updateCursor, otherUsers } = useCursorPresence(dashboardId, displayName)

  // Local state for nodes to handle drag visual feedback
  const [localNodes, setLocalNodes] = useState<Array<Node>>([])

  // Helper function to recursively find the source box with results
  // This allows chaining: Query → Table → Table → Chart
  const findSourceWithResults = useCallback(
    (
      boxId: Id<'boxes'>,
      targetToSourceMap: Map<Id<'boxes'>, Id<'boxes'>>,
      boxMap: Map<Id<'boxes'>, Box>,
      visited: Set<Id<'boxes'>> = new Set(),
      depth = 0,
    ): Box | undefined => {
      // Prevent infinite loops with circular dependencies
      if (depth > 10 || visited.has(boxId)) return undefined
      visited.add(boxId)

      // Get immediate parent
      const sourceBoxId = targetToSourceMap.get(boxId)
      if (!sourceBoxId) return undefined

      const sourceBox = boxMap.get(sourceBoxId)
      if (!sourceBox) return undefined

      // If this source has results, return it
      if (sourceBox.results) return sourceBox

      // Otherwise, recurse up the chain to find the ultimate data source
      return findSourceWithResults(sourceBoxId, targetToSourceMap, boxMap, visited, depth + 1)
    },
    [],
  )

  // Convert boxes and annotations to React Flow nodes
  const baseNodes = useMemo<Array<Node>>(() => {
    // Create lookup maps for O(1) access instead of O(n) finds
    const boxMap = new Map(boxes.map((b) => [b._id, b]))
    const targetToSourceMap = new Map(edgeData.map((e) => [e.targetBoxId, e.sourceBoxId]))

    const boxNodes = boxes.map((box) => {
      // For table/chart nodes, find connected source box with results
      // This recursively traverses the graph to find the ultimate data source
      let sourceBox
      if (box.type === 'table' || box.type === 'chart') {
        sourceBox = findSourceWithResults(box._id, targetToSourceMap, boxMap)
      }

      return {
        id: box._id,
        type: box.type,
        position: { x: box.positionX, y: box.positionY },
        width: box.width,
        height: box.height,
        zIndex: 1000, // Boxes always above annotations
        data: {
          box,
          dashboardId,
          sessionId,
          shareKey,
          onUpdate: onUpdateBox,
          onDelete: onDeleteBox,
          onCreateConnectedBox,
          sourceBox,
          // Pass all boxes to query nodes so they can load named query results
          boxes: box.type === 'query' ? boxes : undefined,
        },
      }
    })

    const annotationNodes = annotations.map((annotation) => ({
      id: annotation._id,
      type: annotation.type,
      position: { x: annotation.positionX, y: annotation.positionY },
      width: annotation.width,
      height: annotation.height,
      zIndex: 1, // Annotations always below boxes
      data: {
        annotation,
        onUpdate: onUpdateAnnotation,
        onDelete: onDeleteAnnotation,
      },
    }))

    return [...boxNodes, ...annotationNodes]
  }, [
    boxes,
    annotations,
    edgeData,
    dashboardId,
    sessionId,
    shareKey,
    onUpdateBox,
    onDeleteBox,
    onCreateConnectedBox,
    onUpdateAnnotation,
    onDeleteAnnotation,
    findSourceWithResults,
  ])

  // Sync baseNodes to localNodes when boxes change from Convex
  useEffect(() => {
    setLocalNodes(baseNodes)
  }, [baseNodes])

  // Convert edge data to React Flow edges with directional arrows
  const edges = useMemo<Array<Edge>>(
    () =>
      edgeData.map((edge) => ({
        id: `${edge.sourceBoxId}-${edge.targetBoxId}`,
        source: edge.sourceBoxId,
        target: edge.targetBoxId,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        style: {
          strokeWidth: 2,
        },
      })),
    [edgeData],
  )

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        onCreateEdge(params.source as Id<'boxes'>, params.target as Id<'boxes'>)
      }
    },
    [onCreateEdge],
  )

  // Detect if adding an edge would create a cycle using DFS
  const wouldCreateCycle = useCallback(
    (newSourceId: Id<'boxes'>, newTargetId: Id<'boxes'>): boolean => {
      // Build adjacency list including the proposed new edge
      const adjacency = new Map<string, Set<string>>()

      // Add existing edges
      for (const edge of edgeData) {
        if (!adjacency.has(edge.sourceBoxId)) {
          adjacency.set(edge.sourceBoxId, new Set())
        }
        adjacency.get(edge.sourceBoxId)!.add(edge.targetBoxId)
      }

      // Add proposed edge
      if (!adjacency.has(newSourceId)) {
        adjacency.set(newSourceId, new Set())
      }
      adjacency.get(newSourceId)!.add(newTargetId)

      // DFS from newTargetId to see if we can reach newSourceId (which would be a cycle)
      const visited = new Set<string>()
      const stack: Array<string> = [newTargetId]

      while (stack.length > 0) {
        const current = stack.pop()!
        if (current === newSourceId) return true // Cycle detected!

        if (visited.has(current)) continue
        visited.add(current)

        const neighbors = adjacency.get(current)
        if (neighbors) {
          for (const neighbor of neighbors) {
            stack.push(neighbor)
          }
        }
      }

      return false // No cycle
    },
    [edgeData],
  )

  // Validate connections - prevent self-loops and cycles
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      if (!connection.source || !connection.target) return false

      // Prevent self-loops
      if (connection.source === connection.target) {
        toast.error('Cannot create connection', {
          description: 'Cannot connect a node to itself',
        })
        return false
      }

      // Prevent cycles
      if (wouldCreateCycle(connection.source as Id<'boxes'>, connection.target as Id<'boxes'>)) {
        toast.error('Cannot create connection', {
          description: 'This connection would create a cycle',
        })
        return false
      }

      return true
    },
    [wouldCreateCycle],
  )

  // Handle canvas click when a tool is selected
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!selectedTool) return

      // Convert screen coordinates to flow coordinates (accounting for zoom/pan)
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // Handle box creation
      if (selectedTool === 'query' || selectedTool === 'table' || selectedTool === 'chart') {
        onCreateBox(selectedTool, position.x, position.y)
        setSelectedTool(null)
      }
      // Handle text annotation creation (single click)
      else if (selectedTool === 'text') {
        onCreateAnnotation(selectedTool, position.x, position.y)
        setSelectedTool(null)
      }
      // dashed-box and drawing tools are handled via separate tool components
    },
    [selectedTool, onCreateBox, onCreateAnnotation, screenToFlowPosition],
  )

  // Handle node position and dimension changes
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Apply changes to local state immediately for visual feedback
      setLocalNodes((nds) => {
        const updatedNodes = applyNodeChanges(changes, nds)

        // Persist to DB only when drag/resize is complete
        changes.forEach((change) => {
          if (change.type === 'position' && change.position && change.dragging === false) {
            // Check if it's a box or annotation
            const isBox = boxes.some((b) => b._id === change.id)
            if (isBox) {
              onUpdateBox(change.id as Id<'boxes'>, {
                positionX: change.position.x,
                positionY: change.position.y,
              })
            } else {
              onUpdateAnnotation(change.id as Id<'annotations'>, {
                positionX: change.position.x,
                positionY: change.position.y,
              })
            }
          }
          if (change.type === 'dimensions' && change.dimensions && change.resizing === false) {
            // Get the node's current position (after changes applied)
            const node = updatedNodes.find((n) => n.id === change.id)
            if (!node) return

            // Check if it's a box or annotation
            const isBox = boxes.some((b) => b._id === change.id)
            if (isBox) {
              onUpdateBox(change.id as Id<'boxes'>, {
                positionX: node.position.x,
                positionY: node.position.y,
                width: change.dimensions.width,
                height: change.dimensions.height,
              })
            } else {
              onUpdateAnnotation(change.id as Id<'annotations'>, {
                positionX: node.position.x,
                positionY: node.position.y,
                width: change.dimensions.width,
                height: change.dimensions.height,
              })
            }
          }
          if (change.type === 'remove') {
            // Handle deletion (triggered by Delete/Backspace key)
            const isBox = boxes.some((b) => b._id === change.id)
            if (isBox) {
              onDeleteBox(change.id as Id<'boxes'>)
            } else {
              onDeleteAnnotation(change.id as Id<'annotations'>)
            }
          }
        })

        return updatedNodes
      })
    },
    [boxes, annotations, onUpdateBox, onUpdateAnnotation, onDeleteBox, onDeleteAnnotation],
  )

  // Track cursor movement with throttling
  const handleMouseMove = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      updateCursor(e.clientX, e.clientY)

      // Handle drawing mode
      if (isDrawing && selectedTool === 'drawing') {
        const flowPosition = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        })
        // Store both screen coords (for preview) and flow coords (for final save)
        setPreviewPoints((prev) => [...prev, [e.clientX, e.clientY, 0.5]])
        setDrawingPoints((prev) => [...prev, [flowPosition.x, flowPosition.y, 0.5]])
      }
    },
    [updateCursor, isDrawing, selectedTool, screenToFlowPosition],
  )

  // Handle drawing start
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (selectedTool === 'drawing') {
        const flowPosition = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        })
        setIsDrawing(true)
        setDrawingStartPos(flowPosition)
        setPreviewPoints([[e.clientX, e.clientY, 0.5]])
        setDrawingPoints([[flowPosition.x, flowPosition.y, 0.5]])
      }
    },
    [selectedTool, screenToFlowPosition],
  )

  // Handle drawing end
  const handlePointerUp = useCallback(() => {
    if (isDrawing && selectedTool === 'drawing' && drawingPoints.length > 0 && drawingStartPos) {
      // Calculate bounding box for the drawing (using flow coordinates)
      const xs = drawingPoints.map((p) => p[0]).filter((x): x is number => x !== undefined)
      const ys = drawingPoints.map((p) => p[1]).filter((y): y is number => y !== undefined)

      if (xs.length === 0 || ys.length === 0) return

      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...xs)
      const maxY = Math.max(...ys)
      const width = maxX - minX + 20 // Add padding
      const height = maxY - minY + 20

      // Adjust points to be relative to the bounding box
      const relativePoints = drawingPoints.map((p) => [
        (p[0] ?? 0) - minX + 10,
        (p[1] ?? 0) - minY + 10,
        p[2] ?? 0.5,
      ])

      onCreateAnnotation(
        'drawing',
        minX - 10,
        minY - 10,
        JSON.stringify(relativePoints),
        width,
        height,
      )

      setIsDrawing(false)
      setDrawingPoints([])
      setPreviewPoints([])
      setDrawingStartPos(null)
      setSelectedTool(null)
    }
  }, [isDrawing, selectedTool, drawingPoints, drawingStartPos, onCreateAnnotation])

  const handleRunAll = useCallback(async () => {
    if (duckdbLoading) {
      toast.error('DuckDB is still loading', {
        description: 'Please wait for DuckDB to finish initializing',
      })
      return
    }

    // Filter only query boxes with content
    const queryBoxes = boxes.filter((box) => box.type === 'query' && box.content?.trim())

    if (queryBoxes.length === 0) {
      toast.info('No query boxes to run', {
        description: 'Create a query box and add SQL to get started',
      })
      return
    }

    toast.info('Running all queries', {
      description: `Executing ${queryBoxes.length} ${queryBoxes.length === 1 ? 'query' : 'queries'}...`,
    })

    let successCount = 0
    let errorCount = 0

    // Load all datasets once before running queries
    try {
      for (const dataset of datasets) {
        if (dataset.downloadUrl) {
          await loadParquetFromURL(dataset.downloadUrl, dataset.name)
        }
      }
    } catch (err) {
      console.error('Failed to load datasets:', err)
      toast.error('Failed to load datasets', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
      return
    }

    // Execute queries sequentially (to handle dependencies between queries)
    for (const queryBox of queryBoxes) {
      try {
        // Load results from other named query boxes (for chaining)
        for (const otherBox of boxes) {
          if (otherBox.type === 'query' && otherBox.title && otherBox.results) {
            try {
              await loadQueryResults(otherBox.title, otherBox.results)
            } catch (err) {
              console.error(`Failed to load query results for "${otherBox.title}":`, err)
            }
          }
        }

        // Execute the query
        const startTime = performance.now()
        const result = await executeQuery(queryBox.content!)
        const executionTime = performance.now() - startTime

        // Convert BigInt values to strings for JSON serialization
        const serializableRows = result.rows.map((row) =>
          row.map((value) => (typeof value === 'bigint' ? value.toString() : value)),
        )

        // Limit stored rows to prevent Convex size limits
        const MAX_STORED_ROWS = 1000
        const storedRows = serializableRows.slice(0, MAX_STORED_ROWS)
        const totalRows = serializableRows.length

        // Update with results
        onUpdateBox(queryBox._id, {
          results: JSON.stringify({
            columns: result.columns,
            rows: storedRows,
            executionTime,
            totalRows,
            truncated: totalRows > MAX_STORED_ROWS,
          }),
          runAt: Date.now(),
        })

        successCount++
      } catch (err) {
        console.error(`Query execution failed for box ${queryBox._id}:`, err)
        const errorMessage = err instanceof Error ? err.message : 'Query execution failed'
        onUpdateBox(queryBox._id, {
          results: JSON.stringify({
            error: errorMessage,
            columns: [],
            rows: [],
          }),
        })
        errorCount++
      }
    }

    // Show summary toast
    if (errorCount === 0) {
      toast.success('All queries completed', {
        description: `Successfully executed ${successCount} ${successCount === 1 ? 'query' : 'queries'}`,
      })
    } else {
      toast.warning('Queries completed with errors', {
        description: `${successCount} succeeded, ${errorCount} failed`,
      })
    }
  }, [
    duckdbLoading,
    boxes,
    datasets,
    loadParquetFromURL,
    loadQueryResults,
    executeQuery,
    onUpdateBox,
  ])

  return (
    <div
      className={`h-screen w-full ${selectedTool ? 'cursor-crosshair' : ''}`}
      onMouseMove={handleMouseMove}
    >
      <style>{`
        .react-flow__node.selected,
        .react-flow__node.selected .react-flow__handle {
          outline: none !important;
        }
        .react-flow__node.selectable:focus,
        .react-flow__node.selectable:focus-visible {
          outline: none !important;
        }
      `}</style>
      <TopNav
        dashboard={dashboard}
        selectedTool={selectedTool}
        onSelectTool={setSelectedTool}
        onDatasetClick={() => setDatasetPanelOpen(!datasetPanelOpen)}
        onRunAll={handleRunAll}
      />

      <ReactFlow
        nodes={localNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onPaneClick={onPaneClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handlePointerUp}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        className={selectedTool ? 'cursor-crosshair' : ''}
        panOnDrag={!selectedTool}
        nodesDraggable={!selectedTool}
      >
        <Background variant={BackgroundVariant.Lines} bgColor="var(--canvas-bg)" />
        <Controls />

        {/* Dashed box drawing tool */}
        {selectedTool === 'dashed-box' && (
          <DashedBoxTool
            onCreateAnnotation={onCreateAnnotation}
            onDeselect={() => setSelectedTool(null)}
          />
        )}
      </ReactFlow>

      <CursorOverlay users={otherUsers} />

      {/* Drawing preview overlay - uses screen coordinates */}
      {isDrawing && previewPoints.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 z-50"
          style={{ width: '100%', height: '100%' }}
        >
          <path
            d={getSvgPathFromStroke(
              getStroke(previewPoints, {
                size: 12,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
              }),
            )}
            fill="var(--foreground)"
            opacity={0.7}
          />
        </svg>
      )}

      <DatasetPanel
        isOpen={datasetPanelOpen}
        onClose={() => setDatasetPanelOpen(false)}
        dashboardId={dashboardId}
      />
    </div>
  )
}

// Wrapper component that provides ReactFlowProvider context
export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
