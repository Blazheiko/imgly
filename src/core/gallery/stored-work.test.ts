import { describe, expect, it } from 'vitest'
import { createWork, type Work } from '../document'
import {
  ADJUSTMENT_KEYS,
  ADJUSTMENT_RANGES,
  NEUTRAL_ADJUSTMENTS,
  type Adjustments,
} from '../adjust'
import { identityGeometry, type Geometry, type Rotation } from '../geometry'
import type { ImageFormat } from '../image-header'
import {
  STORED_WORK_FORMAT,
  toStoredFields,
  validateRecordShape,
  validateStoredWork,
  type StoredWorkFields,
} from './stored-work'

const FORMATS: ImageFormat[] = ['jpeg', 'png', 'gif', 'webp', 'avif', 'heic']
const ROTATIONS: Rotation[] = [0, 90, 180, 270]
const PARTS = { hasOriginal: true, hasLayer: false }
const TOUCHED_AT = 1_700_000_000_000

/** Deterministic PRNG (mulberry32) so a failing property case is reproducible. */
function prng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeWork(
  width: number,
  height: number,
  overrides: Partial<Work> = {},
  source: { sourceName: string; sourceFormat: ImageFormat } = {
    sourceName: 'photo',
    sourceFormat: 'jpeg',
  },
): Work {
  const work = createWork(
    { width, height, pixels: null, hasTransparency: false },
    'work-1',
    source,
    TOUCHED_AT,
  )
  return { ...work, ...overrides }
}

/** What a stored `works` record looks like: the fields plus a thumbnail. */
function recordOf(fields: StoredWorkFields): Record<string, unknown> {
  return { ...fields, thumbnail: new Blob(['x'], { type: 'image/png' }) }
}

function validRecord(): Record<string, unknown> {
  return recordOf(toStoredFields(makeWork(4, 3), TOUCHED_AT))
}

function expectDamaged(result: ReturnType<typeof validateStoredWork>): void {
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.code).toBe('WORK_DAMAGED')
}

describe('STORED_WORK_FORMAT', () => {
  it('is 1', () => {
    expect(STORED_WORK_FORMAT).toBe(1)
  })
})

describe('toStoredFields', () => {
  it('copies the Work into plain record fields, without the thumbnail (AC-04)', () => {
    const work = makeWork(40, 30, {
      geometry: {
        flipH: true,
        flipV: false,
        rotation: 90,
        straighten: -120,
        crop: { x: 1, y: 2, width: 20, height: 10 },
      },
      adjustments: { ...NEUTRAL_ADJUSTMENTS, brightness: 12, sepia: 40 },
      drawing: { id: 'layer-9', width: 40, height: 30, pixels: null },
    })

    const fields = toStoredFields(work, TOUCHED_AT)

    expect(fields).toEqual({
      id: 'work-1',
      sourceName: 'photo',
      sourceFormat: 'jpeg',
      touchedAt: TOUCHED_AT,
      width: 40,
      height: 30,
      hasTransparency: false,
      geometry: work.geometry,
      adjustments: work.adjustments,
      layerId: 'layer-9',
      formatVersion: STORED_WORK_FORMAT,
    })
    expect('thumbnail' in fields).toBe(false)
    expect(fields.geometry).not.toBe(work.geometry)
    expect(fields.geometry.crop).not.toBe(work.geometry.crop)
    expect(fields.adjustments).not.toBe(work.adjustments)
  })

  it('gives layerId null when nothing is drawn', () => {
    expect(toStoredFields(makeWork(4, 3), TOUCHED_AT).layerId).toBeNull()
  })

  it('keeps hasTransparency of the Original', () => {
    const work = makeWork(4, 3)
    work.original = { ...work.original, hasTransparency: true }
    expect(toStoredFields(work, TOUCHED_AT).hasTransparency).toBe(true)
  })
})

describe('validateStoredWork: round trip (AC-04, AC-18)', () => {
  it('a valid stored Work passes and reads back the same fields', () => {
    const fields = toStoredFields(makeWork(4, 3), TOUCHED_AT)
    const result = validateStoredWork(recordOf(fields), PARTS)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual(fields)
  })

  it('toStoredFields then validateStoredWork gives the same values for random valid Works', () => {
    const rand = prng(20260101)
    const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

    for (let i = 0; i < 200; i++) {
      const width = int(1, 4096)
      const height = int(1, 4096)
      const rotation = ROTATIONS[int(0, 3)]!
      const turnedW = rotation === 90 || rotation === 270 ? height : width
      const turnedH = rotation === 90 || rotation === 270 ? width : height
      const cw = int(1, turnedW)
      const ch = int(1, turnedH)
      const geometry: Geometry = {
        flipH: rand() < 0.5,
        flipV: rand() < 0.5,
        rotation,
        straighten: 0,
        crop: { x: int(0, turnedW - cw), y: int(0, turnedH - ch), width: cw, height: ch },
      }
      const adjustments = { ...NEUTRAL_ADJUSTMENTS } as Adjustments
      for (const key of ADJUSTMENT_KEYS) {
        const { min, max } = ADJUSTMENT_RANGES[key]
        adjustments[key] = int(min, max)
      }
      const names = ['', 'photo', 'my photo.v2', '<img src=x onerror=alert(1)>', 'снимок 📷']
      const work = makeWork(
        width,
        height,
        {
          geometry,
          adjustments,
          drawing: rand() < 0.5 ? { id: 'l', width, height, pixels: null } : null,
        },
        { sourceName: names[int(0, names.length - 1)]!, sourceFormat: FORMATS[int(0, 5)]! },
      )
      const fields = toStoredFields(work, TOUCHED_AT + i)
      const result = validateStoredWork(recordOf(fields), {
        hasOriginal: true,
        hasLayer: fields.layerId !== null,
      })

      expect(result.ok, `case ${i}`).toBe(true)
      if (result.ok) expect(result.value, `case ${i}`).toEqual(fields)
    }
  })

  it('accepts a Straighten angle with a Crop well inside the turned image', () => {
    const geometry: Geometry = {
      flipH: false,
      flipV: false,
      rotation: 0,
      straighten: 123,
      crop: { x: 150, y: 100, width: 100, height: 100 },
    }
    const fields = toStoredFields(makeWork(400, 300, { geometry }), TOUCHED_AT)
    const result = validateStoredWork(recordOf(fields), PARTS)
    expect(result.ok).toBe(true)
  })

  it('accepts a Source name with markup, kept as is, and an empty one', () => {
    for (const sourceName of ['<img onerror=alert(1)>', '']) {
      const record = { ...validRecord(), sourceName }
      const result = validateStoredWork(record, PARTS)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.sourceName).toBe(sourceName)
    }
  })

  it('accepts the size bounds 1 and 4096', () => {
    for (const [width, height] of [
      [1, 1],
      [4096, 4096],
    ] as const) {
      const fields = toStoredFields(makeWork(width, height), TOUCHED_AT)
      expect(validateStoredWork(recordOf(fields), PARTS).ok).toBe(true)
    }
  })

  it('accepts a layerId when the layer exists', () => {
    const work = makeWork(4, 3, { drawing: { id: 'l1', width: 4, height: 3, pixels: null } })
    const record = recordOf(toStoredFields(work, TOUCHED_AT))
    expect(validateStoredWork(record, { hasOriginal: true, hasLayer: true }).ok).toBe(true)
  })
})

describe('validateStoredWork: damage kinds (AC-08, AC-18)', () => {
  it('missing-original: no Original blob', () => {
    expectDamaged(validateStoredWork(validRecord(), { hasOriginal: false, hasLayer: false }))
  })

  it('layer-without-record-id: a layer but layerId null', () => {
    expectDamaged(validateStoredWork(validRecord(), { hasOriginal: true, hasLayer: true }))
  })

  it('layerId set but no layer entry', () => {
    const record = { ...validRecord(), layerId: 'l1' }
    expectDamaged(validateStoredWork(record, PARTS))
  })

  it('bad-geometry: Crop outside the image after the stored Rotation', () => {
    const geometry: Geometry = {
      ...identityGeometry({ width: 4, height: 3 }),
      crop: { x: 0, y: 0, width: 99, height: 99 },
    }
    expectDamaged(validateStoredWork({ ...validRecord(), geometry }, PARTS))
  })

  it('bad-geometry: a Crop that fits the unturned image but not the turned one', () => {
    const geometry: Geometry = {
      ...identityGeometry({ width: 4, height: 3 }),
      rotation: 90,
      crop: { x: 0, y: 0, width: 4, height: 3 },
    }
    expectDamaged(validateStoredWork({ ...validRecord(), geometry }, PARTS))
  })

  it('bad-geometry: Rotation not a quarter turn', () => {
    const geometry = { ...identityGeometry({ width: 4, height: 3 }), rotation: 45 }
    expectDamaged(validateStoredWork({ ...validRecord(), geometry }, PARTS))
  })

  it('bad-geometry: Straighten outside -450..450, or not a whole number', () => {
    for (const straighten of [451, -451, 1.5]) {
      const geometry = { ...identityGeometry({ width: 4, height: 3 }), straighten }
      expectDamaged(validateStoredWork({ ...validRecord(), geometry }, PARTS))
    }
  })

  it('unknown-format-version: 2 is never guessed at', () => {
    expectDamaged(validateStoredWork({ ...validRecord(), formatVersion: 2 }, PARTS))
    expectDamaged(validateStoredWork({ ...validRecord(), formatVersion: 999 }, PARTS))
  })

  it('refuses an unknown Source format', () => {
    expectDamaged(validateStoredWork({ ...validRecord(), sourceFormat: 'bmp' }, PARTS))
  })

  it('refuses sizes 0, 4097 and 3.5', () => {
    for (const width of [0, 4097, 3.5]) {
      expectDamaged(validateStoredWork({ ...validRecord(), width }, PARTS))
    }
    expectDamaged(validateStoredWork({ ...validRecord(), height: 4097 }, PARTS))
  })

  it.each(ADJUSTMENT_KEYS)('refuses %s one step outside its range', (key) => {
    const { min, max } = ADJUSTMENT_RANGES[key]
    for (const value of [min - 1, max + 1]) {
      const adjustments = { ...NEUTRAL_ADJUSTMENTS, [key]: value }
      expectDamaged(validateStoredWork({ ...validRecord(), adjustments }, PARTS))
    }
  })

  it('refuses input that is null, a number or has missing fields', () => {
    expectDamaged(validateStoredWork(null, PARTS))
    expectDamaged(validateStoredWork(42, PARTS))
    expectDamaged(validateStoredWork(undefined, PARTS))
    expectDamaged(validateStoredWork({}, PARTS))
    for (const key of Object.keys(validRecord())) {
      const record = validRecord()
      delete record[key]
      expectDamaged(validateStoredWork(record, PARTS))
    }
  })

  it('refuses a record with no thumbnail or a wrong-typed field', () => {
    expectDamaged(validateStoredWork({ ...validRecord(), thumbnail: undefined }, PARTS))
    expectDamaged(validateStoredWork({ ...validRecord(), sourceName: 5 }, PARTS))
    expectDamaged(validateStoredWork({ ...validRecord(), touchedAt: '1' }, PARTS))
    expectDamaged(validateStoredWork({ ...validRecord(), hasTransparency: 'no' }, PARTS))
  })

  it.each([
    ['below the date range', -1e17],
    ['above the date range', 1e17],
  ])('refuses a touchedAt %s (T42, R3-1)', (_l, bad) => {
    expectDamaged(validateStoredWork({ ...validRecord(), touchedAt: bad }, PARTS))
  })
})

describe('validateRecordShape', () => {
  it('accepts a valid record', () => {
    expect(validateRecordShape(validRecord())).toBe(true)
  })

  it('accepts an empty Source name', () => {
    expect(validateRecordShape({ ...validRecord(), sourceName: '' })).toBe(true)
  })

  it('rejects null, a number and a record with a missing field', () => {
    expect(validateRecordShape(null)).toBe(false)
    expect(validateRecordShape(42)).toBe(false)
    const record = validRecord()
    delete record.thumbnail
    expect(validateRecordShape(record)).toBe(false)
  })

  it('rejects wrong primitive types', () => {
    expect(validateRecordShape({ ...validRecord(), sourceName: 5 })).toBe(false)
    expect(validateRecordShape({ ...validRecord(), width: '4' })).toBe(false)
  })

  it('does not check ranges (listing checks shape only)', () => {
    expect(validateRecordShape({ ...validRecord(), width: 99999 })).toBe(true)
    expect(validateRecordShape({ ...validRecord(), formatVersion: 2 })).toBe(true)
  })
})
