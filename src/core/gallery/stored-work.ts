import { ADJUSTMENT_KEYS, ADJUSTMENT_RANGES, type Adjustments } from '../adjust'
import type { Work } from '../document'
import {
  STRAIGHTEN_LIMIT,
  isInsideTurned,
  type CropRect,
  type Geometry,
  type Rotation,
} from '../geometry'
import type { ImageFormat } from '../image-header'
import { appError, err, ok, type AppError, type Result } from '../result'

/** The layout version of a stored `works` record; unknown values are refused, never guessed at. */
export const STORED_WORK_FORMAT = 1

const MAX_SIDE = 4096
const FORMATS: readonly ImageFormat[] = ['jpeg', 'png', 'gif', 'webp', 'avif', 'heic']
const ROTATIONS: readonly number[] = [0, 90, 180, 270]

/** Every `works` field except the thumbnail. */
export interface StoredWorkFields {
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
  formatVersion: number
}

/** A Work's stored fields as plain copies; `layerId` is the drawing layer's id or null. */
export function toStoredFields(work: Work, touchedAt: number): StoredWorkFields {
  const { crop } = work.geometry
  return {
    id: work.id,
    sourceName: work.sourceName,
    sourceFormat: work.sourceFormat,
    touchedAt,
    width: work.original.width,
    height: work.original.height,
    hasTransparency: work.original.hasTransparency,
    geometry: { ...work.geometry, crop: { ...crop } },
    adjustments: { ...work.adjustments },
    layerId: work.drawing ? work.drawing.id : null,
    formatVersion: STORED_WORK_FORMAT,
  }
}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown): v is number => Number.isInteger(v)

function geometryShapeOk(g: unknown): g is Geometry {
  if (!isObj(g) || !isObj(g.crop)) return false
  const c = g.crop
  return (
    typeof g.flipH === 'boolean' &&
    typeof g.flipV === 'boolean' &&
    isNum(g.rotation) &&
    isNum(g.straighten) &&
    isNum(c.x) &&
    isNum(c.y) &&
    isNum(c.width) &&
    isNum(c.height)
  )
}

function adjustmentsShapeOk(a: unknown): a is Adjustments {
  return isObj(a) && ADJUSTMENT_KEYS.every((k) => isNum(a[k]))
}

/** The listing-only check: every field has the right primitive type. No ranges. */
export function validateRecordShape(input: unknown): boolean {
  if (!isObj(input)) return false
  return (
    typeof input.id === 'string' &&
    typeof input.sourceName === 'string' &&
    typeof input.sourceFormat === 'string' &&
    isNum(input.touchedAt) &&
    isNum(input.width) &&
    isNum(input.height) &&
    typeof input.hasTransparency === 'boolean' &&
    geometryShapeOk(input.geometry) &&
    adjustmentsShapeOk(input.adjustments) &&
    (input.layerId === null || typeof input.layerId === 'string') &&
    input.thumbnail !== undefined &&
    input.thumbnail !== null &&
    isNum(input.formatVersion)
  )
}

function geometryOk(g: Geometry, size: { width: number; height: number }): boolean {
  const { crop } = g
  return (
    ROTATIONS.includes(g.rotation) &&
    isInt(g.straighten) &&
    Math.abs(g.straighten) <= STRAIGHTEN_LIMIT &&
    [crop.x, crop.y, crop.width, crop.height].every(isInt) &&
    crop.width >= 1 &&
    crop.height >= 1 &&
    isInsideTurned(crop as CropRect, { ...g, rotation: g.rotation as Rotation }, size)
  )
}

/**
 * The full check on choosing a Work: shape, then sizes, Geometry, Adjustments, Source format,
 * `formatVersion` and the parts that must exist. Every failure is `WORK_DAMAGED`.
 */
export function validateStoredWork(
  input: unknown,
  parts: { hasOriginal: boolean; hasLayer: boolean },
): Result<StoredWorkFields, AppError> {
  const damaged = (reason: string) => err(appError('WORK_DAMAGED', { reason }))
  if (!validateRecordShape(input)) return damaged('shape')
  const r = input as unknown as StoredWorkFields
  if (!parts.hasOriginal) return damaged('missing-original')
  if ((r.layerId !== null) !== parts.hasLayer) return damaged('layer-without-record-id')
  if (r.formatVersion !== STORED_WORK_FORMAT) return damaged('unknown-format-version')
  if (!FORMATS.includes(r.sourceFormat)) return damaged('source-format')
  const sizeOk = (n: number) => isInt(n) && n >= 1 && n <= MAX_SIDE
  if (!sizeOk(r.width) || !sizeOk(r.height)) return damaged('size')
  if (!geometryOk(r.geometry, r)) return damaged('bad-geometry')
  for (const key of ADJUSTMENT_KEYS) {
    const { min, max } = ADJUSTMENT_RANGES[key]
    const v = r.adjustments[key]
    if (v < min || v > max) return damaged('adjustments')
  }
  return ok(toFields(r))
}

function toFields(r: StoredWorkFields): StoredWorkFields {
  return {
    id: r.id,
    sourceName: r.sourceName,
    sourceFormat: r.sourceFormat,
    touchedAt: r.touchedAt,
    width: r.width,
    height: r.height,
    hasTransparency: r.hasTransparency,
    geometry: { ...r.geometry, crop: { ...r.geometry.crop } },
    adjustments: { ...r.adjustments },
    layerId: r.layerId,
    formatVersion: r.formatVersion,
  }
}
