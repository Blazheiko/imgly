/** The subset of `virtual:pwa-register`'s options this client sets; the app shell injects `registerSW`. */
export interface RegisterSWOptions {
  immediate?: boolean
  onNeedRefresh?: () => void
  onOfflineReady?: () => void
  onNeedReload?: () => void
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void
  onRegisterError?: (error: unknown) => void
}

export type RegisterSW = (options: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>

export interface ServiceWorkerCallbacks {
  /** A newer version has downloaded and waits (AC-06). */
  onNeedRefresh(): void
  /** The first worker installed: the app works offline (AC-05). */
  onOfflineReady(): void
  /** A new worker took control of this page (ADR-0002). */
  onControllerChange(): void
}

export interface ServiceWorkerClient {
  /** Whether a worker controlled the page when it loaded; a first install's switch is not an update. */
  readonly hadControllerAtLoad: boolean
  /** Looks for a new version; a failed or offline check resolves silently (AC-15). */
  check(): Promise<void>
  /** Asks the waiting worker to take over. The caller reloads on `onControllerChange`. */
  activateWaiting(): Promise<void>
  /** The waiting worker itself, as an identity for "this version was dismissed" (AC-09). */
  waitingKey(): object | null
}

/**
 * Wraps vite-plugin-pwa's `registerSW` in prompt mode (ADR-0001). The plugin's own reload on a
 * switch is replaced by a no-op, so only the feature store decides when this window reloads.
 * Without a service-worker container the client is inert.
 */
export function createServiceWorkerClient(
  deps: { registerSW: RegisterSW; container: ServiceWorkerContainer | undefined },
  callbacks: ServiceWorkerCallbacks,
): ServiceWorkerClient {
  const { container } = deps
  if (!container) {
    return {
      hadControllerAtLoad: false,
      check: async () => {},
      activateWaiting: async () => {},
      waitingKey: () => null,
    }
  }

  const hadControllerAtLoad = container.controller !== null
  let registration: ServiceWorkerRegistration | undefined
  // The check on start comes before the plugin has registered: it waits for the registration.
  let registered!: () => void
  const ready = new Promise<void>((resolve) => (registered = resolve))
  container.addEventListener('controllerchange', () => callbacks.onControllerChange())
  const updateSW = deps.registerSW({
    immediate: true,
    onNeedRefresh: () => callbacks.onNeedRefresh(),
    onOfflineReady: () => callbacks.onOfflineReady(),
    onNeedReload: () => {},
    onRegisteredSW: (_url, r) => {
      registration = r
      registered()
    },
    onRegisterError: () => registered(),
  })

  return {
    hadControllerAtLoad,
    async check() {
      await ready
      try {
        await registration?.update()
      } catch {
        // Offline, a 404 or a network error: the next scheduled check tries again (AC-15).
      }
    },
    activateWaiting: () => updateSW(true),
    waitingKey: () => registration?.waiting ?? null,
  }
}
