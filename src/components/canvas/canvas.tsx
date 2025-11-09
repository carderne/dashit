import type { Connection, Edge, Node, NodeTypes, OnNodesChange } from '@xyflow/react'
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [selectedTool, setSelectedTool] = useState<'query' | 'table' | 'chart' | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [datasetPanelOpen, setDatasetPanelOpen] = useState(false)
  const { screenToFlowPosition } = useReactFlow()

  // Local state for nodes to handle drag visual feedback
  const [localNodes, setLocalNodes] = useState<Array<Node>>([])

  // Convert boxes to React Flow nodes
  const baseNodes = useMemo<Array<Node>>(() => {
    // Create lookup maps for O(1) access instead of O(n) finds
    const boxMap = new Map(boxes.map((b) => [b._id, b]))
    const targetToSourceMap = new Map(edgeData.map((e) => [e.targetBoxId, e.sourceBoxId]))

    return boxes.map((box) => {
      // For table/chart nodes, find connected source query box using Map lookup
      let sourceBox
      if (box.type === 'table' || box.type === 'chart') {
        const sourceBoxId = targetToSourceMap.get(box._id)
        sourceBox = sourceBoxId ? boxMap.get(sourceBoxId) : undefined
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
  }, [boxes, edgeData, dashboardId, onUpdateBox, onDeleteBox, onCreateConnectedBox])

  // Sync baseNodes to localNodes when boxes change from Convex
  useEffect(() => {
    setLocalNodes(baseNodes)
  }, [baseNodes])

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

  return (
    <div className="h-screen w-full">
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
        nodes={localNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        className={selectedTool ? 'cursor-crosshair' : ''}
      >
        <Background variant={BackgroundVariant.Lines} bgColor="var(--canvas-bg)" />
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
