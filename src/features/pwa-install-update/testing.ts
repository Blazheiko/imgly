/**
 * Test-only entry point of the pwa-install-update feature. Production code never imports this (it
 * pulls in Vitest).
 */
import { vi } from 'vitest'
import { ok, type AppError, type Result } from '@/core'
import type { InstallPrompt } from '@/infra/platform'

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
