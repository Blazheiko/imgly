import { describe, expect, it, vi } from 'vitest'
import {
  createServiceWorkerClient,
  type RegisterSW,
  type RegisterSWOptions,
} from './service-worker'

function fakeContainer(controller: object | null = {}) {
  const target = new EventTarget()
  return Object.assign(target, { controller }) as unknown as ServiceWorkerContainer
}

function fakeRegisterSW() {
  let options: RegisterSWOptions = {}
  const updateSW = vi.fn<(reload?: boolean) => Promise<void>>(async () => {})
  const registerSW = vi.fn((o: RegisterSWOptions) => {
    options = o
    return updateSW
  }) as unknown as RegisterSW & ReturnType<typeof vi.fn>
  return { registerSW, updateSW, options: () => options }
}

function callbacks() {
  return { onNeedRefresh: vi.fn(), onOfflineReady: vi.fn(), onControllerChange: vi.fn() }
}

describe('createServiceWorkerClient (ADR-0001, ADR-0002)', () => {
  it('registers at once and fires onNeedRefresh and onOfflineReady from the plugin (AC-05, AC-06)', () => {
    const sw = fakeRegisterSW()
    const cb = callbacks()
    createServiceWorkerClient({ registerSW: sw.registerSW, container: fakeContainer() }, cb)

    expect(sw.registerSW).toHaveBeenCalledTimes(1)
    expect(sw.options().immediate).toBe(true)
    sw.options().onNeedRefresh!()
    sw.options().onOfflineReady!()
    expect(cb.onNeedRefresh).toHaveBeenCalledTimes(1)
    expect(cb.onOfflineReady).toHaveBeenCalledTimes(1)
  })

  it("takes over the plugin's own reload, so a switch never reloads this window by itself (AC-09)", () => {
    const sw = fakeRegisterSW()
    const reload = vi.fn()
    vi.stubGlobal('location', { ...location, reload })
    createServiceWorkerClient(
      { registerSW: sw.registerSW, container: fakeContainer() },
      callbacks(),
    )

    expect(sw.options().onNeedReload).toBeTypeOf('function')
    sw.options().onNeedReload!()
    expect(reload).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('reports controllerchange (AC-14)', () => {
    const container = fakeContainer()
    const cb = callbacks()
    createServiceWorkerClient({ registerSW: fakeRegisterSW().registerSW, container }, cb)

    container.dispatchEvent(new Event('controllerchange'))
    expect(cb.onControllerChange).toHaveBeenCalledTimes(1)
  })

  it('captures whether the page loaded with a controller at creation', () => {
    const withController = fakeContainer({})
    const without = fakeContainer(null)
    const a = createServiceWorkerClient(
      { registerSW: fakeRegisterSW().registerSW, container: withController },
      callbacks(),
    )
    const b = createServiceWorkerClient(
      { registerSW: fakeRegisterSW().registerSW, container: without },
      callbacks(),
    )
    ;(without as unknown as { controller: object }).controller = {}

    expect(a.hadControllerAtLoad).toBe(true)
    expect(b.hadControllerAtLoad).toBe(false)
  })

  it('checks through registration.update()', async () => {
    const sw = fakeRegisterSW()
    const client = createServiceWorkerClient(
      { registerSW: sw.registerSW, container: fakeContainer() },
      callbacks(),
    )
    const update = vi.fn(async () => {})
    sw.options().onRegisteredSW!('/imgly/sw.js', { update } as unknown as ServiceWorkerRegistration)

    await client.check()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('swallows a failed check (AC-15)', async () => {
    const sw = fakeRegisterSW()
    const client = createServiceWorkerClient(
      { registerSW: sw.registerSW, container: fakeContainer() },
      callbacks(),
    )
    const update = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    sw.options().onRegisteredSW!('/imgly/sw.js', { update } as unknown as ServiceWorkerRegistration)

    await expect(client.check()).resolves.toBeUndefined()
  })

  it('a check made before the registration is known waits for it, then updates (AC-15, spec §6)', async () => {
    const sw = fakeRegisterSW()
    const client = createServiceWorkerClient(
      { registerSW: sw.registerSW, container: fakeContainer() },
      callbacks(),
    )
    let done = false
    const checking = client.check().then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)

    const update = vi.fn(async () => {})
    sw.options().onRegisteredSW!('/imgly/sw.js', { update } as unknown as ServiceWorkerRegistration)
    await checking
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('resolves a waiting check when the registration fails', async () => {
    const sw = fakeRegisterSW()
    const client = createServiceWorkerClient(
      { registerSW: sw.registerSW, container: fakeContainer() },
      callbacks(),
    )
    const checking = client.check()
    sw.options().onRegisterError!(new Error('offline'))
    await expect(checking).resolves.toBeUndefined()
  })

  it('activates the waiting worker through updateSW(true) (AC-07)', async () => {
    const sw = fakeRegisterSW()
    const client = createServiceWorkerClient(
      { registerSW: sw.registerSW, container: fakeContainer() },
      callbacks(),
    )
    await client.activateWaiting()
    expect(sw.updateSW).toHaveBeenCalledWith(true)
  })

  it('identifies the waiting worker by the worker object, not its script URL (AC-09)', () => {
    const sw = fakeRegisterSW()
    const client = createServiceWorkerClient(
      { registerSW: sw.registerSW, container: fakeContainer() },
      callbacks(),
    )
    expect(client.waitingKey()).toBeNull()

    const first = { scriptURL: '/imgly/sw.js' }
    const registration = { waiting: first, update: vi.fn() }
    sw.options().onRegisteredSW!(
      '/imgly/sw.js',
      registration as unknown as ServiceWorkerRegistration,
    )
    expect(client.waitingKey()).toBe(first)

    const second = { scriptURL: '/imgly/sw.js' }
    registration.waiting = second
    expect(client.waitingKey()).toBe(second)
    expect(client.waitingKey()).not.toBe(first)
  })

  it('is inert without a service-worker container', async () => {
    const sw = fakeRegisterSW()
    const cb = callbacks()
    const client = createServiceWorkerClient(
      { registerSW: sw.registerSW, container: undefined },
      cb,
    )

    expect(sw.registerSW).not.toHaveBeenCalled()
    expect(client.hadControllerAtLoad).toBe(false)
    expect(client.waitingKey()).toBeNull()
    await expect(client.check()).resolves.toBeUndefined()
    await expect(client.activateWaiting()).resolves.toBeUndefined()
  })
})
