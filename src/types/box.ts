import type { Id } from '../../convex/_generated/dataModel'

export interface Box {
  _id: Id<'boxes'>
  _creationTime: number
  dashboardId: Id<'dashboards'>
  type: 'query' | 'table' | 'chart'
  positionX: number
  positionY: number
  width: number
  height: number
  content?: string
  results?: string
  lastRunContent?: string
  editedAt?: number
  runAt?: number
  title?: string
  createdAt: number
  updatedAt: number
}

export interface BoxUpdate {
  positionX?: number
  positionY?: number
  width?: number
  height?: number
  content?: string
  results?: string
  lastRunContent?: string
  editedAt?: number
  runAt?: number
  title?: string
}
