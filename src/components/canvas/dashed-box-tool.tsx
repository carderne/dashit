import { useReactFlow, type XYPosition } from '@xyflow/react'
import { useState, type PointerEvent } from 'react'

interface DashedBoxToolProps {
  onCreateAnnotation: (
    type: 'dashed-box',
    x: number,
    y: number,
    content?: string,
    width?: number,
    height?: number,
  ) => void
  onDeselect: () => void
}

function getPosition(start: XYPosition, end: XYPosition) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
  }
}

function getDimensions(start: XYPosition, end: XYPosition, zoom: number = 1) {
  return {
    width: Math.abs(end.x - start.x) / zoom,
    height: Math.abs(end.y - start.y) / zoom,
  }
}

export function DashedBoxTool({ onCreateAnnotation, onDeselect }: DashedBoxToolProps) {
  const [start, setStart] = useState<XYPosition | null>(null)
  const [end, setEnd] = useState<XYPosition | null>(null)

  const { screenToFlowPosition, getViewport } = useReactFlow()

  function handlePointerDown(e: PointerEvent) {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setStart({ x: e.pageX, y: e.pageY })
  }

  function handlePointerMove(e: PointerEvent) {
    if (e.buttons !== 1) return
    setEnd({ x: e.pageX, y: e.pageY })
  }

  function handlePointerUp() {
    if (!start || !end) return

    const position = screenToFlowPosition(getPosition(start, end))
    const dimension = getDimensions(start, end, getViewport().zoom)

    // Only create if there's a meaningful size (not just a click)
    if (dimension.width > 5 && dimension.height > 5) {
      onCreateAnnotation(
        'dashed-box',
        position.x,
        position.y,
        undefined,
        dimension.width,
        dimension.height,
      )
      onDeselect()
    }

    setStart(null)
    setEnd(null)
  }

  const rect =
    start && end
      ? {
          position: getPosition(start, end),
          dimension: getDimensions(start, end),
        }
      : null

  return (
    <div
      className="nopan nodrag"
      style={{
        pointerEvents: 'auto',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 4,
        height: '100%',
        width: '100%',
        transformOrigin: 'top left',
        cursor: 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {rect && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10,
            ...rect.dimension,
            transform: `translate(${rect.position.x}px, ${rect.position.y}px)`,
            border: '3px dashed var(--foreground)',
            borderRadius: '4px',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
