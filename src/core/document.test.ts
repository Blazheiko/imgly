import { describe, expect, it } from 'vitest'
import { createWork, hasUnsavedEdits, withEdit } from './document'

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
