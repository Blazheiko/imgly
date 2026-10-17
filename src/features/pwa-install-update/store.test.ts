import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { UPDATE_CHECK_INTERVAL_MS } from '@/core'
import { useEditorStore } from '@/features/editor'
import { createFakeAutosave } from '@/features/editor/testing'
import { appError, err, ok } from '@/core'
import { useNotices } from '@/shared'
import type { ReloadOutcome } from '@/features/editor'
import {
  ACTION_RELOADING,
  failureInstall,
  UPDATE_TEXT,
  failureExportRunning,
  failureReopenEvicted,
  failureReopenUnreadable,
  failureToolOpen,
  infoOfflineReady,
} from './messages'
import { SWITCH_WAIT_MS, usePwaInstallUpdate, type ResumeDeps } from './store'
import { fakeClient, fakeDocument, fakeInstallPrompt } from './testing'

const MIN = 60 * 1000

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

    it('gives Reload the refresh icon (ui-refresh SCR-06)', () => {
      connect()
      sw.newWaiting()
      expect(updateNotices()[0]!.action?.icon).toBe('refresh-cw')
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

    it('leaves the shown notice as it is when the same wording is raised again (SCR-05, AC-12)', () => {
      connect()
      sw.newWaiting()
      const shown = updateNotices()[0]!
      sw.callbacks().onNeedRefresh() // the same waiting version reported again, e.g. by a check

      // Replacing it would rebuild "Reload" under the Editor's pointer and drop its focus.
      expect(updateNotices()).toEqual([shown])
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('pwa-install-update store — Reload and the reopen after the update (AC-07, AC-08, AC-10 to AC-13)', () => {
  let store: ReturnType<typeof usePwaInstallUpdate>
  let editor: ReturnType<typeof useEditorStore>
  let notices: ReturnType<typeof useNotices>
  let autosave: ReturnType<typeof createFakeAutosave>
  let sw: ReturnType<typeof fakeClient>
  let gate: ReturnType<typeof deferred<ReloadOutcome>>
  let requestReload: ReturnType<typeof vi.fn<() => Promise<ReloadOutcome>>>
  const mark = vi.fn<(id: string) => void>()
  const reloadPage = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    autosave = createFakeAutosave()
    editor = useEditorStore()
    editor.setAutosave(autosave.fake)
    notices = useNotices()
    store = usePwaInstallUpdate()
    sw = fakeClient()
    gate = deferred<ReloadOutcome>()
    requestReload = vi.fn<() => Promise<ReloadOutcome>>(() => gate.promise)
    vi.spyOn(editor, 'requestReload').mockImplementation(requestReload)
    mark.mockReset()
    reloadPage.mockReset()
    store.connect(sw.create, {
      now: () => 0,
      document: fakeDocument().doc,
      mark,
      reloadPage,
    })
  })
  afterEach(() => vi.useRealTimers())

  const updateNotice = () => notices.items.find((n) => n.slot === 'app-update')!
  const chooseReload = () => updateNotice().action!.run()
  const failures = () => notices.items.filter((n) => n.kind === 'failure').map((n) => n.text)
  const answer = async (outcome: ReloadOutcome) => {
    gate.resolve(outcome)
    await vi.advanceTimersByTimeAsync(0)
  }

  it('words the refusals and the failed reopens as the catalog says', () => {
    expect(failureToolOpen()).toBe('Apply or cancel the open tool first.')
    expect(failureExportRunning()).toBe('Wait for the export to finish, then reload.')
    expect(failureReopenEvicted()).toBe(
      "The image you had open couldn't be reopened: it was removed from the Gallery to make room.",
    )
    expect(failureReopenUnreadable()).toBe(
      "The image you had open couldn't be reopened. Open it from the Gallery if it's there.",
    )
    expect(ACTION_RELOADING).toBe('Reloading…')
  })

  describe('Reload with a waiting version (AC-07)', () => {
    beforeEach(() => void sw.newWaiting())

    it('marks the Work, activates the waiting worker and reloads once it takes control', async () => {
      expect(chooseReload()).toBe('keep-open')
      await answer({ kind: 'ready', reopenId: 'work-1' })

      expect(sw.client.activateWaiting).toHaveBeenCalledTimes(1)
      expect(mark).not.toHaveBeenCalled() // only once the switch is sure (ADR-0003, §6.1)
      expect(reloadPage).not.toHaveBeenCalled()

      sw.callbacks().onControllerChange()
      expect(mark).toHaveBeenCalledExactlyOnceWith('work-1')
      expect(mark.mock.invocationCallOrder[0]!).toBeLessThan(
        reloadPage.mock.invocationCallOrder[0]!,
      )
      expect(reloadPage).toHaveBeenCalledTimes(1)
      expect(store.updateNotice).toBe('available')
    })

    it('writes no marker when there is no Stored state', async () => {
      chooseReload()
      await answer({ kind: 'ready', reopenId: null })
      expect(mark).not.toHaveBeenCalled()
      expect(sw.client.activateWaiting).toHaveBeenCalledTimes(1)
    })

    it('shows Reloading… as a busy action while it waits, and ignores Reload meanwhile (AC-11)', async () => {
      chooseReload()
      expect(updateNotice().action).toMatchObject({ busy: true, busyLabel: ACTION_RELOADING })

      expect(chooseReload()).toBe('keep-open')
      expect(requestReload).toHaveBeenCalledTimes(1)

      await answer({ kind: 'ready', reopenId: null })
      expect(updateNotice().action?.busy).toBe(true)
    })

    it('keeps the busy action when the wording changes while it waits', () => {
      chooseReload()
      sw.callbacks().onControllerChange()
      expect(updateNotice().text).toBe(UPDATE_TEXT['updated-elsewhere'])
      expect(updateNotice().action?.busy).toBe(true)
    })

    it('writes no marker and lets the editor go when the switch never comes (AC-08, §6.1)', async () => {
      chooseReload()
      await answer({ kind: 'ready', reopenId: 'work-1' })
      await vi.advanceTimersByTimeAsync(SWITCH_WAIT_MS)

      expect(mark).not.toHaveBeenCalled()
      expect(reloadPage).not.toHaveBeenCalled()
      expect(editor.covered).toBe(false)
      expect(updateNotice().action?.busy).toBe(false)

      sw.callbacks().onControllerChange() // a late switch is another window's, not this Reload
      expect(mark).not.toHaveBeenCalled()
      expect(reloadPage).not.toHaveBeenCalled()
    })

    it('switches once: a second controllerchange neither marks nor reloads again (§6.1)', async () => {
      chooseReload()
      await answer({ kind: 'ready', reopenId: 'work-1' })
      sw.callbacks().onControllerChange()
      sw.callbacks().onControllerChange()

      expect(mark).toHaveBeenCalledExactlyOnceWith('work-1')
      expect(reloadPage).toHaveBeenCalledOnce()
    })

    it('holds the editor from the moment it leaves (AC-10, AC-13)', async () => {
      chooseReload()
      await answer({ kind: 'ready', reopenId: null })
      expect(editor.covered).toBe(true)
    })
  })

  describe('Reload after the version switched elsewhere (AC-14)', () => {
    it('reloads the page without activating a worker when none waits', async () => {
      sw.switched()
      chooseReload()
      await answer({ kind: 'ready', reopenId: 'work-1' })

      expect(mark).toHaveBeenCalledExactlyOnceWith('work-1')
      expect(sw.client.activateWaiting).not.toHaveBeenCalled()
      expect(reloadPage).toHaveBeenCalledTimes(1)
    })

    it('activates a still newer waiting worker instead of reloading into the version between (AC-09)', async () => {
      sw.switched()
      sw.newWaiting()
      expect(store.updateNotice).toBe('updated-elsewhere')
      chooseReload()
      await answer({ kind: 'ready', reopenId: 'work-1' })

      expect(sw.client.activateWaiting).toHaveBeenCalledTimes(1)
      expect(reloadPage).not.toHaveBeenCalled()
      sw.callbacks().onControllerChange()
      expect(mark).toHaveBeenCalledExactlyOnceWith('work-1')
      expect(reloadPage).toHaveBeenCalledTimes(1)
    })

    it('activates the waiting worker when the storage was superseded, so it reloads into the new version (AC-08)', async () => {
      sw.newWaiting()
      autosave.supersede()
      await nextTick()
      expect(store.updateNotice).toBe('reload-to-save')
      chooseReload()
      await answer({ kind: 'ready', reopenId: 'work-1' })

      expect(sw.client.activateWaiting).toHaveBeenCalledTimes(1)
      expect(reloadPage).not.toHaveBeenCalled()
    })
  })

  describe('refusals (AC-10, AC-13)', () => {
    beforeEach(() => void sw.newWaiting())

    it.each([
      [{ kind: 'tool-open' } as const, failureToolOpen()],
      [{ kind: 'exporting' } as const, failureExportRunning()],
    ])('%j refuses, keeps the notice and enables Reload again', async (outcome, text) => {
      chooseReload()
      await answer(outcome)

      expect(failures()).toEqual([text])
      expect(updateNotice().text).toBe(UPDATE_TEXT.available)
      expect(updateNotice().action?.busy).toBeFalsy()
      expect(mark).not.toHaveBeenCalled()
      expect(sw.client.activateWaiting).not.toHaveBeenCalled()
      expect(reloadPage).not.toHaveBeenCalled()
    })

    it('shows one refusal notice for the same refusal twice', async () => {
      chooseReload()
      await answer({ kind: 'tool-open' })
      gate = deferred<ReloadOutcome>()
      chooseReload()
      await answer({ kind: 'tool-open' })

      expect(failures()).toEqual([failureToolOpen()])
    })

    it('keeps a different earlier refusal', async () => {
      chooseReload()
      await answer({ kind: 'tool-open' })
      gate = deferred<ReloadOutcome>()
      chooseReload()
      await answer({ kind: 'exporting' })

      expect(failures()).toEqual([failureToolOpen(), failureExportRunning()])
    })

    it('un-busies an ignored Reload and does nothing else', async () => {
      chooseReload()
      await answer({ kind: 'ignored' })

      expect(updateNotice().action?.busy).toBeFalsy()
      expect(failures()).toEqual([])
      expect(sw.client.activateWaiting).not.toHaveBeenCalled()
      expect(reloadPage).not.toHaveBeenCalled()
    })
  })

  describe('confirmation (AC-12)', () => {
    beforeEach(() => void sw.newWaiting())

    it('asks, and Cancel changes nothing', async () => {
      chooseReload()
      await answer({ kind: 'confirm', reopenId: 'work-1' })
      expect(store.confirming).toEqual({ reopenId: 'work-1' })

      store.cancelReload()
      expect(store.confirming).toBeNull()
      expect(updateNotice().action?.busy).toBeFalsy()
      expect(updateNotice().text).toBe(UPDATE_TEXT.available)
      expect(mark).not.toHaveBeenCalled()
      expect(sw.client.activateWaiting).not.toHaveBeenCalled()
      expect(reloadPage).not.toHaveBeenCalled()
    })

    it('confirming marks the Stored state and leaves', async () => {
      chooseReload()
      await answer({ kind: 'confirm', reopenId: 'work-1' })
      store.confirmReload()

      expect(store.confirming).toBeNull()
      expect(sw.client.activateWaiting).toHaveBeenCalledTimes(1)
      sw.callbacks().onControllerChange()
      expect(mark).toHaveBeenCalledExactlyOnceWith('work-1')
      expect(reloadPage).toHaveBeenCalledTimes(1)
    })

    it('confirming with no Stored state writes no marker', async () => {
      chooseReload()
      await answer({ kind: 'confirm', reopenId: null })
      store.confirmReload()

      expect(mark).not.toHaveBeenCalled()
      expect(sw.client.activateWaiting).toHaveBeenCalledTimes(1)
    })

    it('holds the editor while it asks and after it leaves, and Cancel lets go (AC-10, AC-13)', async () => {
      expect(editor.covered).toBe(false)
      chooseReload()
      await answer({ kind: 'confirm', reopenId: 'work-1' })
      expect(editor.covered).toBe(true)

      store.cancelReload()
      expect(editor.covered).toBe(false)

      gate = deferred<ReloadOutcome>()
      chooseReload()
      await answer({ kind: 'confirm', reopenId: 'work-1' })
      store.confirmReload()
      expect(editor.covered).toBe(true)
    })

    it('ignores confirm and cancel when nothing asks', () => {
      store.confirmReload()
      store.cancelReload()
      expect(sw.client.activateWaiting).not.toHaveBeenCalled()
      expect(reloadPage).not.toHaveBeenCalled()
    })
  })

  it('never reloads on a switch this window did not ask for', () => {
    sw.newWaiting()
    sw.callbacks().onControllerChange()
    sw.callbacks().onControllerChange()
    expect(reloadPage).not.toHaveBeenCalled()
  })

  describe('resumeAfterUpdate (AC-08, ADR-0003)', () => {
    const resume = (workId: string | null, isListed: (id: string) => boolean = () => true) => {
      const reopen = vi.fn<ResumeDeps['reopen']>(async () => {})
      return { reopen, done: store.resumeAfterUpdate(workId, { isListed, reopen }) }
    }

    it('reports start-up settled once the resume has finished, with or without a marker', async () => {
      expect(store.startupSettled).toBe(false)
      let reopened!: () => void
      const reopen = vi.fn(() => new Promise<void>((resolve) => (reopened = resolve)))
      const done = store.resumeAfterUpdate('work-1', { isListed: () => true, reopen })
      await vi.advanceTimersByTimeAsync(0)
      expect(store.startupSettled).toBe(false)
      reopened()
      await done
      expect(store.startupSettled).toBe(true)
    })

    it('reopens nothing without a marker', async () => {
      const { reopen, done } = resume(null)
      await done
      expect(reopen).not.toHaveBeenCalled()
      expect(notices.items).toEqual([])
    })

    it('reopens the marked Work through the Gallery, wording a failed read per SCR-07', async () => {
      const { reopen, done } = resume('work-1')
      await done
      expect(reopen).toHaveBeenCalledExactlyOnceWith('work-1', {
        couldNotOpen: failureReopenUnreadable(),
      })
      expect(notices.items).toEqual([])
    })

    it('takes the marker once, synchronously, and only through takeMarkedWork (ADR-0003)', () => {
      const take = vi.fn().mockReturnValueOnce('work-1').mockReturnValue(null)
      expect(store.takeMarkedWork(take)).toBe('work-1')
      expect(take).toHaveBeenCalledTimes(1)
    })

    it('says the Work was removed to make room when the Gallery no longer lists it', async () => {
      const { reopen, done } = resume('gone', () => false)
      await done
      expect(reopen).not.toHaveBeenCalled()
      expect(failures()).toEqual([failureReopenEvicted()])
    })

    it('waits for an asynchronous listing before deciding the Work is gone', async () => {
      const reopen = vi.fn(async () => {})
      let listed!: (on: boolean) => void
      const done = store.resumeAfterUpdate('work-1', {
        isListed: () => new Promise<boolean>((resolve) => (listed = resolve)),
        reopen,
      })
      await vi.advanceTimersByTimeAsync(0)
      expect(reopen).not.toHaveBeenCalled()
      expect(failures()).toEqual([])
      listed(true)
      await done
      expect(reopen).toHaveBeenCalledExactlyOnceWith('work-1', {
        couldNotOpen: failureReopenUnreadable(),
      })
      expect(failures()).toEqual([])
    })

    it('says the Work was removed when an asynchronous listing does not have it', async () => {
      const reopen = vi.fn(async () => {})
      await store.resumeAfterUpdate('gone', { isListed: async () => false, reopen })
      expect(reopen).not.toHaveBeenCalled()
      expect(failures()).toEqual([failureReopenEvicted()])
    })

    it('says it could not be reopened when the Gallery is unavailable', async () => {
      autosave.available(false)
      const { reopen, done } = resume('work-1')
      await done
      expect(reopen).not.toHaveBeenCalled()
      expect(failures()).toEqual([failureReopenUnreadable()])
    })
  })
})

describe('pwa-install-update store — the install offer (AC-01 to AC-04)', () => {
  let store: ReturnType<typeof usePwaInstallUpdate>
  let notices: ReturnType<typeof useNotices>

  beforeEach(() => {
    setActivePinia(createPinia())
    useEditorStore().setAutosave(createFakeAutosave().fake)
    notices = useNotices()
    store = usePwaInstallUpdate()
  })

  it('words the could-not-install notice as the catalog says', () => {
    expect(failureInstall()).toBe(
      "imgly couldn't be installed. Try installing it from the browser's menu instead.",
    )
  })

  it('offers nothing before an install client is connected', () => {
    expect(store.canInstall).toBe(false)
  })

  it('offers to install only while the browser offers (AC-02)', () => {
    const install = fakeInstallPrompt()
    store.connectInstall(install.client)
    expect(store.canInstall).toBe(false)

    install.setOffer(true)
    expect(store.canInstall).toBe(true)
    install.setOffer(false)
    expect(store.canInstall).toBe(false)
    expect(notices.items).toEqual([])
  })

  it('takes an offer the browser already made', () => {
    const install = fakeInstallPrompt({ offer: true })
    store.connectInstall(install.client)
    expect(store.canInstall).toBe(true)
  })

  it('never offers in the Installed app (AC-04)', () => {
    const install = fakeInstallPrompt({ standalone: true, offer: true })
    store.connectInstall(install.client)
    install.setOffer(true)
    expect(store.canInstall).toBe(false)
  })

  it('opens the browser confirmation; a dismissal shows no notice (AC-01, AC-03)', async () => {
    const install = fakeInstallPrompt({ offer: true })
    store.connectInstall(install.client)
    install.prompt.mockImplementation(async () => {
      install.setOffer(false)
      return ok('dismissed')
    })

    await store.install()
    expect(install.prompt).toHaveBeenCalledTimes(1)
    expect(store.canInstall).toBe(false)
    expect(notices.items).toEqual([])
  })

  it('hides the action while the confirmation is open, and ignores a second click meanwhile (AC-03)', async () => {
    const install = fakeInstallPrompt({ offer: true })
    store.connectInstall(install.client)
    let choose!: () => void
    install.prompt
      .mockImplementationOnce(() => {
        install.setOffer(false)
        return new Promise((resolve) => (choose = () => resolve(ok('accepted'))))
      })
      .mockResolvedValue(err(appError('INSTALL_FAILED')))

    const first = store.install()
    expect(store.canInstall).toBe(false)
    await store.install()
    choose()
    await first

    expect(install.prompt).toHaveBeenCalledTimes(1)
    expect(notices.items).toEqual([])
  })

  it('reports an install in flight until the browser has answered', async () => {
    const install = fakeInstallPrompt({ offer: true })
    store.connectInstall(install.client)
    let answer!: () => void
    install.prompt.mockImplementationOnce(
      () => new Promise((resolve) => (answer = () => resolve(ok('dismissed')))),
    )

    const pending = store.install()
    expect(store.installing).toBe(true)
    answer()
    await pending
    expect(store.installing).toBe(false)
  })

  it('shows no notice once installed (AC-01)', async () => {
    const install = fakeInstallPrompt({ offer: true })
    store.connectInstall(install.client)
    install.prompt.mockResolvedValue(ok('accepted'))

    await store.install()
    expect(notices.items).toEqual([])
  })

  it('shows the could-not-install failure on INSTALL_FAILED (AC-03)', async () => {
    const install = fakeInstallPrompt({ offer: true })
    store.connectInstall(install.client)
    install.prompt.mockResolvedValue(err(appError('INSTALL_FAILED')))

    await store.install()
    expect(notices.items.map((n) => [n.kind, n.text])).toEqual([['failure', failureInstall()]])
  })
})
