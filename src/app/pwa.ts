import { registerSW } from 'virtual:pwa-register'

/** Registers the Workbox service worker that precaches the app shell (offline use and install). */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  registerSW({ immediate: true })
}
