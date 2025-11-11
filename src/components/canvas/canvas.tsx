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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useCursorPresence } from '../../hooks/useCursorPresence'
import type { Box, BoxUpdate } from '../../types/box'
import { DatasetPanel } from '../dataset-panel'
import { ChartBox } from './chart-box'
import { CursorOverlay } from './cursor-overlay'
import { QueryBox } from './query-box'
import { TableBox } from './table-box'
import { TopNav } from './top-nav'

// Define custom node types
// TypeScript struggles with React Flow's NodeTypes, so we use type assertion here
const nodeTypes: NodeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: QueryBox as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: TableBox as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chart: ChartBox as any,
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
}

function CanvasInner({
  dashboard,
  boxes,
  edges: edgeData,
  onCreateBox,
  onUpdateBox,
  onDeleteBox,
  onCreateConnectedBox,
  onCreateEdge,
  onDeleteEdge: _onDeleteEdge,
}: CanvasProps) {
  const [selectedTool, setSelectedTool] = useState<'query' | 'table' | 'chart' | null>(null)
  const [datasetPanelOpen, setDatasetPanelOpen] = useState(false)
  const { screenToFlowPosition } = useReactFlow()
  const { _id: dashboardId } = dashboard

  // Get current user for display name
  const { data: user } = useQuery(convexQuery(api.users.getCurrentUser, {}))
  const displayName = user?.displayName || user?.name || 'Anonymous'

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

  // Convert boxes to React Flow nodes
  const baseNodes = useMemo<Array<Node>>(() => {
    // Create lookup maps for O(1) access instead of O(n) finds
    const boxMap = new Map(boxes.map((b) => [b._id, b]))
    const targetToSourceMap = new Map(edgeData.map((e) => [e.targetBoxId, e.sourceBoxId]))

    return boxes.map((box) => {
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
        data: {
          box,
          dashboardId,
          onUpdate: onUpdateBox,
          onDelete: onDeleteBox,
          onCreateConnectedBox,
          sourceBox,
          // Pass all boxes to query nodes so they can load named query results
          boxes: box.type === 'query' ? boxes : undefined,
        },
        style: {
          width: box.width,
          height: box.height,
        },
      }
    })
  }, [
    boxes,
    edgeData,
    dashboardId,
    onUpdateBox,
    onDeleteBox,
    onCreateConnectedBox,
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

      onCreateBox(selectedTool, position.x, position.y)
      setSelectedTool(null)
    },
    [selectedTool, onCreateBox, screenToFlowPosition],
  )

  // Handle node position and dimension changes
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Apply changes to local state immediately for visual feedback
      setLocalNodes((nds) => applyNodeChanges(changes, nds))

      // Persist to DB only when drag/resize is complete
      changes.forEach((change) => {
        if (change.type === 'position' && change.position && change.dragging === false) {
          // Only update DB when drag is complete (not during drag)
          const boxId = change.id as Id<'boxes'>
          onUpdateBox(boxId, {
            positionX: change.position.x,
            positionY: change.position.y,
          })
        }
        if (change.type === 'dimensions' && change.dimensions && change.resizing === false) {
          // Only update DB when resize is complete (not during resize)
          const boxId = change.id as Id<'boxes'>
          onUpdateBox(boxId, {
            width: change.dimensions.width,
            height: change.dimensions.height,
          })
        }
      })
    },
    [onUpdateBox],
  )

  // Track cursor movement with throttling
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updateCursor(e.clientX, e.clientY)
    },
    [updateCursor],
  )

  return (
    <div
      className={`h-screen w-full ${selectedTool ? 'cursor-crosshair' : ''}`}
      onMouseMove={handleMouseMove}
    >
      <TopNav
        dashboard={dashboard}
        selectedTool={selectedTool}
        onSelectTool={setSelectedTool}
        onDatasetClick={() => setDatasetPanelOpen(!datasetPanelOpen)}
      />

      <ReactFlow
        nodes={localNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        className={selectedTool ? 'cursor-crosshair' : ''}
      >
        <Background variant={BackgroundVariant.Lines} bgColor="var(--canvas-bg)" />
        <Controls />
      </ReactFlow>

      <CursorOverlay users={otherUsers} />

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
