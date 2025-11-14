import type { Id } from '../../convex/_generated/dataModel'

export type AnnotationType = 'text' | 'dashed-box' | 'drawing'

export interface Annotation {
  _id: Id<'annotations'>
  _creationTime: number
  dashboardId: Id<'dashboards'>
  type: AnnotationType
  positionX: number
  positionY: number
  width: number
  height: number
  content?: string
  style?: string
  createdAt: number
  updatedAt: number
}

export interface AnnotationUpdate {
  positionX?: number
  positionY?: number
  width?: number
  height?: number
  content?: string
  style?: string
}

// Style interfaces for different annotation types
export interface TextAnnotationStyle {
  fontSize?: number
  fontWeight?: string
}

export interface DashedBoxStyle {
  borderColor?: string
  borderWidth?: number
  dashArray?: string
}

export interface DrawingStyle {
  strokeColor?: string
  strokeWidth?: number
}
