import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { AnnotationUpdate, TextAnnotationStyle } from '../../types/annotation'

interface TextAnnotationData {
  annotation: {
    _id: Id<'annotations'>
    content?: string
    style?: string
  }
  onUpdate: (annotationId: Id<'annotations'>, updates: AnnotationUpdate) => void
  onDelete: (annotationId: Id<'annotations'>) => void
}

function TextAnnotationComponent({ data, selected }: NodeProps) {
  const { annotation, onUpdate } = data as unknown as TextAnnotationData

  // Parse style
  const style: TextAnnotationStyle = annotation.style
    ? JSON.parse(annotation.style)
    : { fontSize: 48, fontWeight: 'normal' }

  const [content, setContent] = useState(annotation.content || '')
  const [isEditing, setIsEditing] = useState(
    // Start in edit mode if this is a new empty node
    !annotation.content || annotation.content === '',
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on newly created empty text nodes
  useEffect(() => {
    if (!annotation.content || annotation.content === '') {
      // Use requestAnimationFrame and longer timeout for more reliable focus
      requestAnimationFrame(() => {
        setTimeout(() => {
          textareaRef.current?.focus()
          textareaRef.current?.select()
        }, 100)
      })
    }
  }, []) // Only run once on mount to check if this is a new node

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value
      setContent(newContent)
      onUpdate(annotation._id, { content: newContent })
    },
    [annotation._id, onUpdate],
  )

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true)
    // Focus after state update
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }, [])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
  }, [])

  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={50}
        isVisible={selected}
        handleClassName="!w-2 !h-2 !border-2"
      />
      <div className="relative h-full w-full bg-transparent" onDoubleClick={handleDoubleClick}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onBlur={handleBlur}
          placeholder="..."
          readOnly={!isEditing}
          className={`text-foreground h-full w-full resize-none border-none bg-transparent p-2 focus:outline-none ${isEditing ? 'nodrag' : ''}`}
          style={{
            fontSize: `${style.fontSize}px`,
            fontWeight: style.fontWeight,
            cursor: isEditing ? 'text' : 'default',
            pointerEvents: isEditing ? 'auto' : 'none',
          }}
          onPointerDown={(e) => {
            if (isEditing) {
              e.stopPropagation()
            }
          }}
        />
      </div>
    </>
  )
}

export const TextAnnotation = memo(TextAnnotationComponent)
