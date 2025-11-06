import { useConvexAuth } from '@convex-dev/react-query'
import type { Connection, Node, NodeTypes, OnNodesChange, Viewport } from '@xyflow/react'
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AlertCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Box, BoxUpdate } from '../../types/box'
import { DatasetPanel } from '../dataset-panel'
import { UploadDataModal } from '../upload-data-modal'
import { QueryBox } from './query-box'
import { TableBox } from './table-box'
import { ToolPanel } from './tool-panel'

// Define custom node types
// TypeScript struggles with React Flow's NodeTypes, so we use type assertion here
const nodeTypes: NodeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: QueryBox as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: TableBox as any,
}

interface CanvasProps {
  dashboardId: Id<'dashboards'>
  boxes: Array<Box>
  onCreateBox: (type: 'query' | 'table' | 'chart', x: number, y: number) => void
  onUpdateBox: (boxId: Id<'boxes'>, updates: BoxUpdate) => void
  onDeleteBox: (boxId: Id<'boxes'>) => void
}

export function Canvas({ dashboardId, boxes, onCreateBox, onUpdateBox, onDeleteBox }: CanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedTool, setSelectedTool] = useState<'query' | 'table' | 'chart' | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [datasetPanelOpen, setDatasetPanelOpen] = useState(false)
  const { isAuthenticated } = useConvexAuth()

  // Filter boxes based on viewport for performance (viewport culling)
  const visibleBoxes = boxes.filter((box) => {
    // Calculate viewport bounds in canvas coordinates
    const viewportWidth = window.innerWidth / viewport.zoom
    const viewportHeight = window.innerHeight / viewport.zoom
    const viewportX = -viewport.x / viewport.zoom
    const viewportY = -viewport.y / viewport.zoom

    // Add padding to load boxes slightly outside viewport
    const padding = 200
    const minX = viewportX - padding
    const maxX = viewportX + viewportWidth + padding
    const minY = viewportY - padding
    const maxY = viewportY + viewportHeight + padding

    // Check if box intersects with viewport
    const boxRight = box.positionX + box.width
    const boxBottom = box.positionY + box.height

    return !(box.positionX > maxX || boxRight < minX || box.positionY > maxY || boxBottom < minY)
  })

  // Convert visible boxes to React Flow nodes
  const flowNodes: Array<Node> = visibleBoxes.map((box) => ({
    id: box._id,
    type: box.type,
    position: { x: box.positionX, y: box.positionY },
    data: {
      box,
      dashboardId,
      onUpdate: onUpdateBox,
      onDelete: onDeleteBox,
    },
    style: {
      width: box.width,
      height: box.height,
    },
  }))

  // Update nodes when visible boxes change
  useEffect(() => {
    setNodes(flowNodes)
  }, [visibleBoxes.length, boxes.length])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  )

  // Handle canvas click when a tool is selected
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!selectedTool) return

      // Get the click position relative to the canvas
      const reactFlowBounds = (event.target as HTMLElement)
        .closest('.react-flow')
        ?.getBoundingClientRect()

      if (!reactFlowBounds) return

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      }

      onCreateBox(selectedTool, position.x, position.y)
      setSelectedTool(null)
    },
    [selectedTool, onCreateBox],
  )

  // Handle node position changes
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)

      // Update positions in database
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const boxId = change.id as Id<'boxes'>
          onUpdateBox(boxId, {
            positionX: change.position.x,
            positionY: change.position.y,
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
    <div className="h-screen w-full">
      <ToolPanel
        selectedTool={selectedTool}
        onSelectTool={setSelectedTool}
        onUploadClick={() => setUploadModalOpen(true)}
        onDatasetClick={() => setDatasetPanelOpen(!datasetPanelOpen)}
      />

      {/* Guest User Banner */}
      {!isAuthenticated && (
        <div className="absolute top-4 left-1/2 z-10 max-w-md -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400 shadow-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>
              <strong>Guest Mode:</strong> Your datasets are stored temporarily (24h). Sign in to
              save permanently.
            </p>
          </div>
        </div>
      )}

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
      >
        <Background />
        <Controls />
        <MiniMap />
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
