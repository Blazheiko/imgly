import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { UPDATE_CHECK_INTERVAL_MS } from '@/core'
import { useEditorStore } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import type { ServiceWorkerCallbacks, ServiceWorkerClient } from '@/infra/platform'
import { useNotices } from '@/shared'
import { UPDATE_TEXT, infoOfflineReady } from './messages'
import { usePwaInstallUpdate } from './store'

const MIN = 60 * 1000

function fakeDocument(visible = true) {
  const target = new EventTarget()
  const doc = Object.assign(target, {
    visibilityState: (visible ? 'visible' : 'hidden') as DocumentVisibilityState,
  })
  return {
    doc,
    setVisible(on: boolean) {
      doc.visibilityState = on ? 'visible' : 'hidden'
      doc.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

function fakeClient(options: { hadControllerAtLoad?: boolean } = {}) {
  let callbacks!: ServiceWorkerCallbacks
  let waiting: object | null = { worker: 1 }
  const client = {
    hadControllerAtLoad: options.hadControllerAtLoad ?? true,
    check: vi.fn(async () => {}),
    activateWaiting: vi.fn(async () => {}),
    waitingKey: vi.fn(() => waiting),
  } satisfies ServiceWorkerClient
  const create = vi.fn((cb: ServiceWorkerCallbacks) => {
    callbacks = cb
    return client
  })
  return {
    client,
    create,
    callbacks: () => callbacks,
    /** A (new) waiting worker has downloaded. */
    newWaiting(key: object = { worker: Math.random() }) {
      waiting = key
      callbacks.onNeedRefresh()
      return key
    },
  }
}

describe('pwa-install-update store — the update lifecycle', () => {
  let store: ReturnType<typeof usePwaInstallUpdate>
  let notices: ReturnType<typeof useNotices>
  let autosave: ReturnType<typeof createFakeAutosave>
  let sw: ReturnType<typeof fakeClient>
  let page: ReturnType<typeof fakeDocument>
  let clock: number

  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    autosave = createFakeAutosave()
    useEditorStore().setAutosave(autosave.fake)
    notices = useNotices()
    store = usePwaInstallUpdate()
    sw = fakeClient()
    page = fakeDocument()
    clock = 1_700_000_000_000
  })
  afterEach(() => vi.useRealTimers())

  const connect = (client = sw) =>
    store.connect(client.create, { now: () => clock, document: page.doc })
  const updateNotices = () => notices.items.filter((n) => n.slot === 'app-update')
  const texts = () => notices.items.map((n) => n.text)
  const dismissUpdate = () => notices.dismiss(updateNotices()[0]!.id)

  describe('the update notice (AC-06, AC-09, AC-14)', () => {
    it('shows one lasting notice in the app-update slot with Reload when a version waits (AC-06)', () => {
      connect()
      sw.newWaiting()

      expect(store.updateNotice).toBe('available')
      expect(updateNotices()).toHaveLength(1)
      const notice = updateNotices()[0]!
      expect(notice.kind).toBe('lasting')
      expect(notice.text).toBe('A new version of imgly is available.')
      expect(notice.action?.label).toBe('Reload')
    })

    it('words the three states as the catalog says', () => {
      expect(UPDATE_TEXT).toEqual({
        available: 'A new version of imgly is available.',
        'updated-elsewhere': 'imgly was updated in another window. Reload to use the new version.',
        'reload-to-save':
          'imgly was updated in another window. Reload this window to keep saving to the Gallery.',
      })
    })

    it('never times out (AC-06)', () => {
      connect()
      sw.newWaiting()
      vi.advanceTimersByTime(10 * 60 * MIN)
      expect(updateNotices()).toHaveLength(1)
    })

    it('keeps the notice hidden after a dismissal while the same version waits (AC-09)', () => {
      connect()
      const key = sw.newWaiting()
      dismissUpdate()
      expect(updateNotices()).toHaveLength(0)

      sw.newWaiting(key)
      expect(updateNotices()).toHaveLength(0)
    })

    it('shows the notice again at once for a still newer version (AC-09)', () => {
      connect()
      sw.newWaiting()
      dismissUpdate()

      sw.newWaiting({ worker: 'newer' })
      expect(updateNotices().map((n) => n.text)).toEqual(['A new version of imgly is available.'])
    })

    it('shows updated-elsewhere after another window switched, even after a dismissal (AC-14)', () => {
      connect()
      sw.newWaiting()
      dismissUpdate()

      sw.callbacks().onControllerChange()
      expect(store.updateNotice).toBe('updated-elsewhere')
      expect(updateNotices().map((n) => n.text)).toEqual([UPDATE_TEXT['updated-elsewhere']])
    })

    it('replaces the available notice in place, so one update notice shows (AC-14)', () => {
      connect()
      notices.pushAll([{ kind: 'failure', text: 'Before' }])
      sw.newWaiting()
      notices.pushAll([{ kind: 'failure', text: 'After' }])

      sw.callbacks().onControllerChange()
      expect(texts()).toEqual(['Before', UPDATE_TEXT['updated-elsewhere'], 'After'])
    })

    it('never goes back from updated-elsewhere to available', () => {
      connect()
      sw.callbacks().onControllerChange()
      sw.newWaiting()
      expect(store.updateNotice).toBe('updated-elsewhere')
      expect(updateNotices().map((n) => n.text)).toEqual([UPDATE_TEXT['updated-elsewhere']])
    })

    it('rewords to reload-to-save when the storage was superseded, even after a dismissal (AC-14)', async () => {
      connect()
      sw.callbacks().onControllerChange()
      dismissUpdate()

      autosave.supersede()
      await nextTick()
      expect(store.updateNotice).toBe('reload-to-save')
      expect(updateNotices().map((n) => n.text)).toEqual([UPDATE_TEXT['reload-to-save']])

      sw.callbacks().onControllerChange()
      sw.newWaiting()
      expect(store.updateNotice).toBe('reload-to-save')
    })

    it('ignores the switch of a first install, when no worker controlled the page (AC-05)', () => {
      const first = fakeClient({ hadControllerAtLoad: false })
      connect(first)
      first.callbacks().onControllerChange()

      expect(store.updateNotice).toBe('none')
      expect(updateNotices()).toHaveLength(0)
    })

    it('counts a later switch after a first install as an update elsewhere', () => {
      const first = fakeClient({ hadControllerAtLoad: false })
      connect(first)
      first.callbacks().onControllerChange()
      first.callbacks().onControllerChange()
      expect(store.updateNotice).toBe('updated-elsewhere')
    })

    it('keeps the notice open when Reload is chosen', () => {
      connect()
      sw.newWaiting()
      expect(updateNotices()[0]!.action!.run()).toBe('keep-open')
    })
  })

  describe('the offline-ready notice (AC-05)', () => {
    it('shows one info notice when the app was first stored for offline use', () => {
      connect()
      sw.callbacks().onOfflineReady()
      sw.callbacks().onOfflineReady()

      expect(texts()).toEqual([infoOfflineReady()])
      expect(infoOfflineReady()).toBe('imgly is ready to work offline.')
      expect(notices.items[0]!.kind).toBe('info')
    })
  })

  describe('the check schedule (AC-15, spec §6)', () => {
    it('checks on start and once every 60 minutes while visible', async () => {
      connect()
      expect(sw.client.check).toHaveBeenCalledTimes(1)

      clock += UPDATE_CHECK_INTERVAL_MS - 1000
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS - 1000)
      expect(sw.client.check).toHaveBeenCalledTimes(1)
      clock += 1000
      await vi.advanceTimersByTimeAsync(1000)
      expect(sw.client.check).toHaveBeenCalledTimes(2)
    })

    it('does not check while hidden, and checks on becoming visible after 60 minutes', async () => {
      page = fakeDocument(false)
      connect()
      expect(sw.client.check).not.toHaveBeenCalled()

      page.setVisible(true)
      expect(sw.client.check).toHaveBeenCalledTimes(1)

      page.setVisible(false)
      clock += 2 * UPDATE_CHECK_INTERVAL_MS
      await vi.advanceTimersByTimeAsync(2 * UPDATE_CHECK_INTERVAL_MS)
      expect(sw.client.check).toHaveBeenCalledTimes(1)

      page.setVisible(true)
      expect(sw.client.check).toHaveBeenCalledTimes(2)
    })

    it('makes no burst of checks on tab switches', () => {
      connect()
      clock += 10 * MIN
      page.setVisible(false)
      page.setVisible(true)
      page.setVisible(false)
      page.setVisible(true)
      expect(sw.client.check).toHaveBeenCalledTimes(1)
    })

    it('stays silent when a check fails and tries again only at the next check (AC-15)', async () => {
      sw.client.check.mockImplementation(async () => {
        throw new TypeError('offline')
      })
      connect()
      await vi.advanceTimersByTimeAsync(0)

      expect(notices.items).toEqual([])
      expect(store.updateNotice).toBe('none')
      clock += 30 * MIN
      await vi.advanceTimersByTimeAsync(30 * MIN)
      expect(sw.client.check).toHaveBeenCalledTimes(1)
    })
  })
})
