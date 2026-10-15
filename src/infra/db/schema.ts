import type { DBSchema } from 'idb'
import type { Adjustments, Geometry, ImageFormat } from '../../core'

/** A Work's small record (gallery ADR-0002); its Original and layer live in their own stores. */
export interface WorkRecord {
  id: string
  sourceName: string
  sourceFormat: ImageFormat
  touchedAt: number
  width: number
  height: number
  hasTransparency: boolean
  geometry: Geometry
  adjustments: Adjustments
  layerId: string | null
  thumbnail: Blob
  formatVersion: number
}

export interface WorkBlobRecord {
  workId: string
  png: Blob
}

export interface MetaRecord {
  key: 'persistenceRequested'
}

export interface ImglyDb extends DBSchema {
  works: { key: string; value: WorkRecord; indexes: { touchedAt: number } }
  originals: { key: string; value: WorkBlobRecord }
  layers: { key: string; value: WorkBlobRecord }
  meta: { key: MetaRecord['key']; value: MetaRecord }
}
