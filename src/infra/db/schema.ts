import type { DBSchema } from 'idb'

/** The persisted record of a Work. Persistence features widen it through new migration steps. */
export interface WorkRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface ImglyDb extends DBSchema {
  works: {
    key: string
    value: WorkRecord
    indexes: { updatedAt: number }
  }
}
