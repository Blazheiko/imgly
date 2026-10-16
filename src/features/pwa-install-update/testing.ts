/**
 * Test-only entry point of the pwa-install-update feature. Production code never imports this (it
 * pulls in Vitest).
 */
import { vi } from 'vitest'
import { ok, type AppError, type Result } from '@/core'
import type { InstallPrompt, ServiceWorkerCallbacks, ServiceWorkerClient } from '@/infra/platform'

/** A scriptable browser install offer (AC-01 to AC-04). */
export function fakeInstallPrompt(options: { standalone?: boolean; offer?: boolean } = {}) {
  const listeners: (() => void)[] = []
  let offer = options.offer ?? false
  const prompt = vi.fn<() => Promise<Result<'accepted' | 'dismissed', AppError>>>(async () =>
    ok('dismissed'),
  )
  const client: InstallPrompt = {
    isStandalone: () => options.standalone ?? false,
    hasOffer: () => offer,
    onOfferChange: (cb) => void listeners.push(cb),
    prompt,
  }
  return {
    client,
    prompt,
    setOffer(on: boolean) {
      offer = on
      listeners.forEach((cb) => cb())
    },
  }
}

/** A page whose visibility a test switches (spec §6 check schedule). */
export function fakeDocument(visible = true) {
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

/** A scriptable service-worker client; `newWaiting()` reports a (new) waiting version. */
export function fakeClient(options: { hadControllerAtLoad?: boolean } = {}) {
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
    /** Another window switched: its worker took control, and none waits any more. */
    switched() {
      waiting = null
      callbacks.onControllerChange()
    },
    /** A (new) waiting worker has downloaded. */
    newWaiting(key: object = { worker: Math.random() }) {
      waiting = key
      callbacks.onNeedRefresh()
      return key
    },
  }
}
