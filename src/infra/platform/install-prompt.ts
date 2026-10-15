import { appError, err, ok, type AppError, type Result } from '@/core'

/** How long an accepted install waits for `appinstalled` before it counts as failed. AC-03 */
export const INSTALL_WAIT_MS = 10_000

export type InstallChoice = 'accepted' | 'dismissed'

/** Chromium's deferred install offer; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: InstallChoice; platform: string }>
}

export interface InstallPrompt {
  /** The app runs as the Installed app in its own window. AC-04 */
  isStandalone(): boolean
  /** The browser offers installation right now. AC-02 */
  hasOffer(): boolean
  /** Called whenever the browser makes or withdraws its offer. */
  onOfferChange(callback: () => void): void
  /** Shows the browser's install confirmation; call only from the Editor's click. AC-01, AC-03 */
  prompt(): Promise<Result<InstallChoice, AppError>>
}

/**
 * Wraps `beforeinstallprompt` / `appinstalled` / display-mode standalone. The offer is single-use:
 * any `prompt()` drops it, and only a new `beforeinstallprompt` brings it back.
 */
export function createInstallPrompt(
  deps: {
    target?: EventTarget
    matchMedia?: (query: string) => Pick<MediaQueryList, 'matches'>
    installWaitMs?: number
  } = {},
): InstallPrompt {
  const target = deps.target ?? window
  const matchMedia = deps.matchMedia ?? ((query: string) => window.matchMedia(query))
  const installWaitMs = deps.installWaitMs ?? INSTALL_WAIT_MS
  const listeners: (() => void)[] = []
  let offer: BeforeInstallPromptEvent | null = null
  let prompting = false
  let installed: (() => void) | null = null

  const changed = () => listeners.forEach((listener) => listener())

  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    offer = event as BeforeInstallPromptEvent
    changed()
  })
  target.addEventListener('appinstalled', () => {
    offer = null
    installed?.()
    changed()
  })

  /** Resolves true on `appinstalled` (also one that came earlier in this prompt), false on timeout. */
  function waitForInstall(alreadyInstalled: Promise<boolean>): Promise<boolean> {
    return Promise.race([
      alreadyInstalled,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), installWaitMs)),
    ])
  }

  return {
    isStandalone: () => matchMedia('(display-mode: standalone)').matches,
    hasOffer: () => offer !== null,
    onOfferChange: (callback) => void listeners.push(callback),
    async prompt() {
      const event = offer
      if (!event || prompting) return err(appError('INSTALL_FAILED'))
      prompting = true
      offer = null
      const appInstalled = new Promise<boolean>((resolve) => (installed = () => resolve(true)))
      try {
        await event.prompt()
        const { outcome } = await event.userChoice
        if (outcome === 'dismissed') return ok('dismissed')
        return (await waitForInstall(appInstalled))
          ? ok('accepted')
          : err(appError('INSTALL_FAILED'))
      } catch {
        return err(appError('INSTALL_FAILED'))
      } finally {
        prompting = false
        installed = null
        changed()
      }
    },
  }
}
