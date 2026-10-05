import { describe, expect, it } from 'vitest'
import { createWork, hasUnsavedEdits, withEdit } from './document'

const original = { width: 4096, height: 2731, pixels: 'bitmap' }

describe('Work revision (ADR 0005)', () => {
  it('starts clean with revision = cleanRevision = 0', () => {
    const work = createWork(original, 'w-1', 1000)

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
    const work = createWork(original, 'w-1', 1000)
    const edited = withEdit(work, 2000)

    expect(edited.revision).toBe(1)
    expect(edited.cleanRevision).toBe(0)
    expect(edited.updatedAt).toBe(2000)
    expect(hasUnsavedEdits(edited)).toBe(true)
  })

  it('never mutates the Work it was given', () => {
    const work = createWork(original, 'w-1', 1000)
    withEdit(work)

    expect(work.revision).toBe(0)
    expect(hasUnsavedEdits(work)).toBe(false)
  })
})
