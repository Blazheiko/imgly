import type { Pinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import { usePwaInstallUpdate } from '@/features/pwa-install-update'
import { createInstallPrompt, createServiceWorkerClient } from '@/infra/platform'

/**
 * Connects the install offer in every build, and in production registers the Workbox service worker
 * in prompt mode, so a new version waits for the Editor's "Reload" (pwa-install-update ADR-0001).
 */
export function connectPwa(pinia: Pinia): void {
  const store = usePwaInstallUpdate(pinia)
  store.connectInstall(createInstallPrompt())
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  store.connect((callbacks) =>
    createServiceWorkerClient({ registerSW, container: navigator.serviceWorker }, callbacks),
  )
}
