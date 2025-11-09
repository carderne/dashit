import type { Connection, Edge, Node, NodeTypes, OnNodesChange, Viewport } from '@xyflow/react'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useMemo, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Box, BoxUpdate } from '../../types/box'
import { DatasetPanel } from '../dataset-panel'
import { ThemeSelector } from '../theme-selector'
import { UploadDataModal } from '../upload-data-modal'
import { ChartBox } from './chart-box'
import { QueryBox } from './query-box'
import { TableBox } from './table-box'
import { ToolPanel } from './tool-panel'
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
  dashboardId: Id<'dashboards'>
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
  dashboardId,
  boxes,
  edges: edgeData,
  onCreateBox,
  onUpdateBox,
  onDeleteBox,
  onCreateConnectedBox,
  onCreateEdge,
  onDeleteEdge: _onDeleteEdge,
}: CanvasProps) {
  const [, , onNodesChange] = useNodesState<Node>([])
  const [, , onEdgesChange] = useEdgesState<Edge>([])
  const [selectedTool, setSelectedTool] = useState<'query' | 'table' | 'chart' | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [datasetPanelOpen, setDatasetPanelOpen] = useState(false)
  const { screenToFlowPosition } = useReactFlow()

  // Convert boxes to React Flow nodes with viewport culling integrated
  const nodes = useMemo<Array<Node>>(() => {
    // Calculate viewport bounds for culling
    const viewportWidth = window.innerWidth / viewport.zoom
    const viewportHeight = window.innerHeight / viewport.zoom
    const viewportX = -viewport.x / viewport.zoom
    const viewportY = -viewport.y / viewport.zoom
    const padding = 200
    const minX = viewportX - padding
    const maxX = viewportX + viewportWidth + padding
    const minY = viewportY - padding
    const maxY = viewportY + viewportHeight + padding

    // Filter and map in one pass
    return boxes
      .filter((box) => {
        const boxRight = box.positionX + box.width
        const boxBottom = box.positionY + box.height
        return !(
          box.positionX > maxX ||
          boxRight < minX ||
          box.positionY > maxY ||
          boxBottom < minY
        )
      })
      .map((box) => {
        // For table/chart nodes, find connected source query box
        let sourceBox
        if (box.type === 'table' || box.type === 'chart') {
          const incomingEdge = edgeData.find((edge) => edge.targetBoxId === box._id)
          if (incomingEdge) {
            sourceBox = boxes.find((b) => b._id === incomingEdge.sourceBoxId)
          }
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
          },
          style: {
            width: box.width,
            height: box.height,
          },
        }
      })
  }, [boxes, edgeData, viewport, dashboardId, onUpdateBox, onDeleteBox, onCreateConnectedBox])

  // Convert edge data to React Flow edges
  const edges = useMemo<Array<Edge>>(
    () =>
      edgeData.map((edge) => ({
        id: `${edge.sourceBoxId}-${edge.targetBoxId}`,
        source: edge.sourceBoxId,
        target: edge.targetBoxId,
        type: 'default',
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
      onNodesChange(changes)

      // Update positions and dimensions in database
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const boxId = change.id as Id<'boxes'>
          onUpdateBox(boxId, {
            positionX: change.position.x,
            positionY: change.position.y,
          })
        }
        if (change.type === 'dimensions' && change.dimensions) {
          const boxId = change.id as Id<'boxes'>
          onUpdateBox(boxId, {
            width: change.dimensions.width,
            height: change.dimensions.height,
          })
        }
      })
    },
    [onNodesChange, onUpdateBox],
  )

  // Track viewport changes for culling
  const onMove = useCallback((_event: MouseEvent | TouchEvent | null, newViewport: Viewport) => {
    setViewport(newViewport)
  }, [])

  return (
    <div className="h-screen w-full" style={{ backgroundColor: 'var(--canvas-bg)' }}>
      <TopNav />

      <ToolPanel
        selectedTool={selectedTool}
        onSelectTool={setSelectedTool}
        onUploadClick={() => setUploadModalOpen(true)}
        onDatasetClick={() => setDatasetPanelOpen(!datasetPanelOpen)}
      />

      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeSelector />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onMove={onMove}
        nodeTypes={nodeTypes}
        fitView
        className={selectedTool ? 'cursor-crosshair' : ''}
        style={{ backgroundColor: 'var(--canvas-bg)' }}
      >
        <Background color="var(--canvas-bg)" />
        <Controls />
      </ReactFlow>

      <UploadDataModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadComplete={() => {
          // Refresh datasets list if panel is open
          // The datasets query will auto-refresh via React Query
        }}
      />

      <DatasetPanel isOpen={datasetPanelOpen} onClose={() => setDatasetPanelOpen(false)} />
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
