import type { NodeProps } from '@xyflow/react'
import { getStroke } from 'perfect-freehand'
import { memo, useMemo } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { AnnotationUpdate, DrawingStyle } from '../../types/annotation'

interface DrawingAnnotationData {
  annotation: {
    _id: Id<'annotations'>
    content?: string
    style?: string
  }
  onUpdate: (annotationId: Id<'annotations'>, updates: AnnotationUpdate) => void
  onDelete: (annotationId: Id<'annotations'>) => void
}

// Convert points array to SVG path data
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

function DrawingAnnotationComponent({ data }: NodeProps) {
  const { annotation } = data as unknown as DrawingAnnotationData

  // Parse style and content (points)
  const style: DrawingStyle = annotation.style
    ? JSON.parse(annotation.style)
    : { strokeColor: 'var(--foreground)', strokeWidth: 12 }

  const points = useMemo<number[][]>(() => {
    if (!annotation.content) return []
    try {
      return JSON.parse(annotation.content) as number[][]
    } catch {
      return []
    }
  }, [annotation.content])

  // Generate stroke path
  const pathData = useMemo(() => {
    if (points.length === 0) return ''

    const stroke = getStroke(points, {
      size: style.strokeWidth,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    })

    return getSvgPathFromStroke(stroke)
  }, [points, style.strokeWidth])

  return (
    <div className="relative h-full w-full bg-transparent">
      {pathData && (
        <svg className="pointer-events-none h-full w-full" style={{ overflow: 'visible' }}>
          <path d={pathData} fill={style.strokeColor} />
        </svg>
      )}
    </div>
  )
}

export const DrawingAnnotation = memo(DrawingAnnotationComponent)
