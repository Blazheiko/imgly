import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appError, err, type AppError, type Result } from '@/core'
import type { LoadedWork } from '@/infra/db'
import type { AutosaveDeps } from './autosave'

// The real createAutosave is replaced by a recorder so the test sees the deps the store builds it
// with — in particular `damagedIds`, which the real one hands to storeWork as `damaged`.
const captured = vi.hoisted(() => ({ deps: null as unknown }))
vi.mock('./autosave', async (importOriginal) => {
  const original = await importOriginal<typeof import('./autosave')>()
  const { createFakeAutosave: fake } = await import('./testing')
  return {
    ...original,
    createAutosave: (deps: unknown) => {
      captured.deps = deps
      return fake().fake
    },
  }
})

import { useEditorStore } from './store'

// Pinned API (T26, review S1-3 page half): the editor store keeps a page-level set of damaged Work
// ids, exposed as the readonly `damagedIds` (ReadonlySet<string>), fed by `markDamaged(id)` and by a
// reopen that returns { kind: 'damaged' }, and handed to createAutosave as its `damagedIds` dep.
describe('editor store — page-level damaged ids (gallery AC-08, S1-3)', () => {
  let editor: ReturnType<typeof useEditorStore>
  const loadWork = vi.fn<(id: string) => Promise<Result<LoadedWork, AppError>>>()
  const decodePng = vi.fn()
  const deps = () => captured.deps as AutosaveDeps

  beforeEach(() => {
    setActivePinia(createPinia())
    captured.deps = null
    editor = useEditorStore()
    loadWork.mockReset()
    loadWork.mockResolvedValue(err(appError('WORK_DAMAGED', { reason: 'missing-original' })))
    editor.setReopenSource({ loadWork, decodePng })
  })

  it('starts empty, and Autosave is built with a damagedIds that reads the same set', () => {
    expect(editor.damagedIds.size).toBe(0)
    expect(deps().damagedIds).toBeTypeOf('function')
    expect([...deps().damagedIds!()]).toEqual([])
  })

  it('a reopen that returns damaged adds the id, and Autosave sees it for the next save', async () => {
    const outcome = await editor.reopenWork('stored-9')

    expect(outcome).toMatchObject({ kind: 'damaged' })
    expect(editor.damagedIds.has('stored-9')).toBe(true)
    expect(deps().damagedIds!().has('stored-9')).toBe(true)
  })

  it('markDamaged(id) adds to the same set that Autosave reads', () => {
    editor.markDamaged('thumb-bad')

    expect(editor.damagedIds.has('thumb-bad')).toBe(true)
    expect(deps().damagedIds!().has('thumb-bad')).toBe(true)
    expect(deps().damagedIds!().has('other')).toBe(false)
  })

  it('R2-2: a reopen that cannot read storage (STORAGE_FAILED) does not mark the Work damaged', async () => {
    loadWork.mockResolvedValue(err(appError('STORAGE_FAILED')))

    expect(await editor.reopenWork('stored-9')).toMatchObject({ kind: 'damaged' })

    expect(editor.damagedIds.has('stored-9')).toBe(false)
  })

  it('R2-2: a committed save of a marked Work clears its mark, and only its own', () => {
    editor.markDamaged('a')
    editor.markDamaged('b')

    deps().onStored!('a')

    expect(editor.damagedIds.has('a')).toBe(false)
    expect(editor.damagedIds.has('b')).toBe(true)
    expect(deps().damagedIds!().has('a')).toBe(false)
  })
})
