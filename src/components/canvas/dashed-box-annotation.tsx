import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { memo } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { AnnotationUpdate, DashedBoxStyle } from '../../types/annotation'

interface DashedBoxAnnotationData {
  annotation: {
    _id: Id<'annotations'>
    content?: string
    style?: string
  }
  onUpdate: (annotationId: Id<'annotations'>, updates: AnnotationUpdate) => void
  onDelete: (annotationId: Id<'annotations'>) => void
}

function DashedBoxAnnotationComponent({ data, selected }: NodeProps) {
  const { annotation } = data as unknown as DashedBoxAnnotationData

  // Parse style
  const style: DashedBoxStyle = annotation.style
    ? JSON.parse(annotation.style)
    : { borderColor: 'var(--foreground)', borderWidth: 3, dashArray: '8 4' }

  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={100}
        isVisible={selected}
        handleClassName="!w-2 !h-2 !border-2"
      />
      <div
        className="relative h-full w-full bg-transparent"
        style={{
          border: `${style.borderWidth}px dashed ${style.borderColor}`,
          borderRadius: '4px',
        }}
      />
    </>
  )
}

export const DashedBoxAnnotation = memo(DashedBoxAnnotationComponent)
