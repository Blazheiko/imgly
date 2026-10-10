import { describe, expect, expectTypeOf, it } from 'vitest'
import { createWork, hasUnsavedEdits, withEdit, type DrawingLayer } from './document'
import { NEUTRAL_ADJUSTMENTS } from './adjust'

const original = { width: 4096, height: 2731, pixels: 'bitmap', hasTransparency: false }
const source = { sourceName: 'IMG_4021', sourceFormat: 'heic' } as const

describe('Work revision (ADR 0005)', () => {
  it('starts clean with revision = cleanRevision = 0', () => {
    const work = createWork(original, 'w-1', source, 1000)

    expect(work).toMatchObject({
      id: 'w-1',
      original,
      revision: 0,
      cleanRevision: 0,
      createdAt: 1000,
      updatedAt: 1000,
    })
    expect(hasUnsavedEdits(work)).toBe(false)
  })

  it('has Unsaved edits after withEdit, which raises the revision', () => {
    const work = createWork(original, 'w-1', source, 1000)
    const edited = withEdit(work, 2000)

    expect(edited.revision).toBe(1)
    expect(edited.cleanRevision).toBe(0)
    expect(edited.updatedAt).toBe(2000)
    expect(hasUnsavedEdits(edited)).toBe(true)
  })

  it('never mutates the Work it was given', () => {
    const work = createWork(original, 'w-1', source, 1000)
    withEdit(work)

    expect(work.revision).toBe(0)
    expect(hasUnsavedEdits(work)).toBe(false)
  })
})

describe('Work source facts (export AC-08, AC-15)', () => {
  it('carries the Source name and Source format, and no placeholder name', () => {
    const work = createWork(original, 'w-1', source, 1000)

    expect(work.sourceName).toBe('IMG_4021')
    expect(work.sourceFormat).toBe('heic')
    expect(work).not.toHaveProperty('name')
  })

  it('keeps the source facts and the transparency fact across an edit', () => {
    const transparent = { ...original, hasTransparency: true }
    const edited = withEdit(createWork(transparent, 'w-1', source, 1000))

    expect(edited).toMatchObject({ sourceName: 'IMG_4021', sourceFormat: 'heic' })
    expect(edited.original.hasTransparency).toBe(true)
  })
})

describe('Work Drawing layer (draw ADR-0001, AC-13)', () => {
  it('starts every new Work with an empty Drawing layer', () => {
    expect(createWork(original, 'w-1', source).drawing).toBeNull()
  })

  it('keeps the Drawing layer across an edit', () => {
    const layer = { id: 'l-1', width: 4096, height: 2731, pixels: 'canvas' }
    const drawn = { ...createWork(original, 'w-1', source), drawing: layer }
    expect(withEdit(drawn).drawing).toBe(layer)
  })
})

describe('Work Adjustments (adjust ADR-0001, AC-17)', () => {
  it('starts every new Work with neutral Adjustments', () => {
    const work = createWork(original, 'w-1', source, 1000)

    expect(work.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
  })

  it('keeps the Adjustments across an edit', () => {
    const work = createWork(original, 'w-1', source, 1000)
    const adjusted = { ...work, adjustments: { ...work.adjustments, contrast: 20 } }

    expect(withEdit(adjusted).adjustments.contrast).toBe(20)
  })
})

describe('Work.drawing typing (draw ADR-0001)', () => {
  it('types the Drawing layer by its own pixel holder, kept through withEdit', () => {
    const work = createWork<string, { canvas: true }>(original, 'w-1', source)
    expectTypeOf(work.drawing).toEqualTypeOf<DrawingLayer<{ canvas: true }> | null>()
    expectTypeOf(withEdit(work).drawing).toEqualTypeOf<DrawingLayer<{ canvas: true }> | null>()
  })
})
