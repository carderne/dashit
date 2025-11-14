import type { Id } from '../../convex/_generated/dataModel'

export interface Dataset {
  _id: Id<'datasets'>
  _creationTime: number
  name: string
  fileName: string
  r2Key?: string
  fileSizeBytes: number
  userId?: Id<'users'>
  isPublic: boolean
  createdAt: number
}

export interface InMemoryDataset {
  name: string
  fileName: string
  data: ArrayBuffer
  fileSizeBytes: number
}
