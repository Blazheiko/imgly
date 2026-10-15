import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import type { IDBPDatabase } from 'idb'
import { ok } from '@/core'
import { loadWork, openDb, type ImglyDb } from '@/infra/db'
import { storedWorkFixture } from '@/infra/db/testing'
import { useEditorStore } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import { useGallery } from '../store'
import * as m from '../messages'
import GalleryList from './GalleryList.vue'

type Db = IDBPDatabase<ImglyDb>

const NOW = 1_700_000_000_000
const MINUTE = 60_000
let dbCounter = 0

async function seed(db: Db, sourceName: string, touchedAt: number): Promise<string> {
  const w = storedWorkFixture({ layer: null, record: { sourceName, touchedAt } })
  await db.put('works', w.record)
  await db.put('originals', w.original)
  return w.record.id
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
  await nextTick()
}

// Pinned API: DeleteWorkDialog takes no props. It renders nothing while useGallery().pendingDelete
// is null; otherwise a Dialog titled deleteDialogTitle(name) with deleteDialogBody(), a secondary
// Cancel (cancelDelete) and a primary Delete (confirmDelete). Esc and backdrop call cancelDelete.
// GalleryList mounts it, so the start screen and the overlay both confirm deletes; the list's
// Delete buttons are `aria-label`led.
describe('DeleteWorkDialog (SCR-04, AC-06)', () => {
  let db: Db
  let editor: ReturnType<typeof useEditorStore>
  let gallery: ReturnType<typeof useGallery>
  let wrapper: VueWrapper
  let ids: Record<string, string>

  const deleteButton = (name: string) =>
    wrapper.get<HTMLButtonElement>(`[aria-label="${m.deleteButtonName(name)}"]`)
  const entryButton = (label: string) => wrapper.get<HTMLButtonElement>(`[aria-label="${label}"]`)
  const dialog = () => wrapper.find('[role="alertdialog"]')

  beforeEach(async () => {
    // happy-dom's Blob does not survive fake-indexeddb's structured clone; Node's does.
    const { Blob: NodeBlob } = await vi.importActual<{ Blob: typeof Blob }>('node:buffer')
    vi.stubGlobal('Blob', NodeBlob)
    setActivePinia(createPinia())
    db = await openDb(`imgly-gallery-dialog-${++dbCounter}`)
    editor = useEditorStore()
    editor.setAutosave(createFakeAutosave().fake)
    editor.setReopenSource({
      loadWork: (id) => loadWork(db, id),
      decodePng: async () => ok({ width: 4, height: 3, close: vi.fn() } as unknown as ImageBitmap),
    })
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true) } })
    URL.createObjectURL = () => 'blob:test/x'
    URL.revokeObjectURL = () => {}
    ids = {
      a: await seed(db, 'A.png', NOW - MINUTE),
      b: await seed(db, 'B.png', NOW - 2 * MINUTE),
      c: await seed(db, '', NOW - 3 * MINUTE),
    }
    gallery = useGallery()
    gallery.connect(ok(db))
    gallery.setClock(() => NOW)
    await gallery.refresh()
    wrapper = mount(
      defineComponent({
        render: () => [h(GalleryList, { showClose: false, showOpenImage: true })],
      }),
      { attachTo: document.body },
    )
    await nextTick()
  })

  afterEach(() => {
    wrapper.unmount()
    vi.unstubAllGlobals()
    db.close()
  })

  it('renders nothing until a delete is requested', () => {
    expect(dialog().exists()).toBe(false)
  })

  it('names the Work, says it cannot be brought back, and focuses Cancel', async () => {
    await deleteButton('B.png').trigger('click')
    await nextTick()
    expect(dialog().exists()).toBe(true)
    expect(dialog().get('h2').text()).toBe(m.deleteDialogTitle('B.png'))
    expect(dialog().text()).toContain(m.deleteDialogBody())
    expect(dialog().get('.base-button--secondary').text()).toBe(m.deleteDialogCancel())
    expect(dialog().get('.base-button--primary').text()).toBe(m.deleteDialogConfirm())
    expect(document.activeElement?.textContent?.trim()).toBe(m.deleteDialogCancel())
  })

  it('titles an unnamed Work "Untitled"', async () => {
    await deleteButton('Untitled').trigger('click')
    await nextTick()
    expect(dialog().get('h2').text()).toBe(m.deleteDialogTitle('Untitled'))
  })

  describe('cancel keeps the Work and returns focus to its Delete', () => {
    const cases: [string, () => Promise<void>][] = [
      ['Cancel', () => dialog().get('.base-button--secondary').trigger('click')],
      ['Esc', () => dialog().trigger('keydown', { key: 'Escape' })],
      ['backdrop', () => wrapper.get('[data-testid="dialog-backdrop"]').trigger('click')],
    ]
    it.each(cases)('%s', async (_name, cancel) => {
      const del = deleteButton('B.png')
      del.element.focus()
      await del.trigger('click')
      await nextTick()
      await cancel()
      await flush()
      expect(dialog().exists()).toBe(false)
      expect(gallery.pendingDelete).toBeNull()
      expect(gallery.count).toBe(3)
      expect(await db.count('works')).toBe(3)
      expect(document.activeElement).toBe(deleteButton('B.png').element)
    })
  })

  it('confirming removes the Work from the list and the database, count down by one', async () => {
    await deleteButton('B.png').trigger('click')
    await nextTick()
    await dialog().get('.base-button--primary').trigger('click')
    await flush()
    expect(dialog().exists()).toBe(false)
    expect(await db.get('works', ids.b!)).toBeUndefined()
    expect(wrapper.find(`[aria-label="${m.deleteButtonName('B.png')}"]`).exists()).toBe(false)
    expect(wrapper.get('[data-testid="gallery-count"]').text()).toBe(m.countLabel(2))
  })

  it('after a delete, focus moves to the next entry', async () => {
    await deleteButton('A.png').trigger('click')
    await nextTick()
    await dialog().get('.base-button--primary').trigger('click')
    await flush()
    expect(document.activeElement).toBe(entryButton('B.png, 2 minutes ago').element)
  })

  it('after deleting the last entry in the list, focus moves to the previous one', async () => {
    await deleteButton('Untitled').trigger('click')
    await nextTick()
    await dialog().get('.base-button--primary').trigger('click')
    await flush()
    expect(document.activeElement).toBe(entryButton('B.png, 2 minutes ago').element)
  })

  it('after deleting the only entry, focus moves to the empty-state Open image', async () => {
    await db.delete('works', ids.a!)
    await db.delete('works', ids.b!)
    await db.delete('originals', ids.a!)
    await db.delete('originals', ids.b!)
    await gallery.refresh()
    await nextTick()
    await deleteButton('Untitled').trigger('click')
    await nextTick()
    await dialog().get('.base-button--primary').trigger('click')
    await flush()
    expect(wrapper.text()).toContain(m.emptyState())
    expect(document.activeElement?.textContent?.trim()).toBe('Open image')
  })
})
