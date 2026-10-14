/**
 * Test-only fixtures for the Gallery stores. Production code never imports this. The PNGs are real
 * (a 4 x 3 and a 5 x 5 transparent image), so a codec size check passes against a 4 x 3 record.
 */
import { NEUTRAL_ADJUSTMENTS, identityGeometry } from '../../core'
import { newId } from '../../shared/ids'
import type { WorkBlobRecord, WorkRecord } from './schema'

const PNG_4X3 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAADElEQVR4nGNgIBkAAAAzAAGHXpxVAAAAAElFTkSuQmCC'
const PNG_5X5 =
  'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAADElEQVR4nGNgoBMAAABpAAERPu2nAAAAAElFTkSuQmCC'

const FIXTURE_TOUCHED_AT = 1_700_000_000_000

function pngBlob(base64: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

/** A valid `WorkRecord` (4 x 3, no layer). */
export function workRecordFixture(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: newId(),
    sourceName: 'test-photo',
    sourceFormat: 'jpeg',
    touchedAt: FIXTURE_TOUCHED_AT,
    width: 4,
    height: 3,
    hasTransparency: false,
    geometry: identityGeometry({ width: 4, height: 3 }),
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
    layerId: null,
    thumbnail: pngBlob(PNG_4X3),
    formatVersion: 1,
    ...overrides,
  }
}

export interface StoredWorkFixture {
  record: WorkRecord
  original: WorkBlobRecord
  layer: WorkBlobRecord | null
}

/** A stored Work as read back, possibly missing its Original. */
export interface DamagedWorkFixture extends Omit<StoredWorkFixture, 'original'> {
  original: WorkBlobRecord | null
}

export interface StoredWorkOverrides {
  record?: Partial<WorkRecord>
  /** `null` stores the Work without a Drawing layer (and sets `layerId` to `null`). */
  layer?: null
}

/** A stored Work: record, Original and (by default) a layer, linked by `workId`. */
export function storedWorkFixture(overrides: StoredWorkOverrides = {}): StoredWorkFixture {
  const withLayer = overrides.layer !== null
  const record = workRecordFixture({
    layerId: withLayer ? newId() : null,
    ...overrides.record,
  })
  if (!withLayer) record.layerId = null
  return {
    record,
    original: { workId: record.id, png: pngBlob(PNG_4X3) },
    layer: withLayer ? { workId: record.id, png: pngBlob(PNG_4X3) } : null,
  }
}

export type DamageKind =
  | 'missing-original'
  | 'layer-without-record-id'
  | 'size-mismatch'
  | 'bad-geometry'
  | 'unknown-format-version'

/** A stored Work broken in exactly one way. */
export function damagedWorkFixture(kind: DamageKind): DamagedWorkFixture {
  const work = storedWorkFixture()
  switch (kind) {
    case 'missing-original':
      return { ...work, original: null }
    case 'layer-without-record-id':
      return { ...work, record: { ...work.record, layerId: null } }
    case 'size-mismatch':
      return { ...work, original: { workId: work.record.id, png: pngBlob(PNG_5X5) } }
    case 'bad-geometry':
      return {
        ...work,
        record: {
          ...work.record,
          geometry: { ...work.record.geometry, crop: { x: 0, y: 0, width: 99, height: 99 } },
        },
      }
    case 'unknown-format-version':
      return { ...work, record: { ...work.record, formatVersion: 999 } }
  }
}
