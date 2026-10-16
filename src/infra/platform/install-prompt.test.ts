import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INSTALL_WAIT_MS, createInstallPrompt } from './install-prompt'

type Outcome = 'accepted' | 'dismissed'

function offerEvent(outcome: Outcome | 'reject' = 'dismissed', choiceDelayMs = 0) {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  let resolveChoice!: (c: { outcome: Outcome; platform: string }) => void
  const userChoice = new Promise<{ outcome: Outcome; platform: string }>((r) => (resolveChoice = r))
  const prompt = vi.fn(async () => {
    if (outcome === 'reject') throw new DOMException('not allowed', 'NotAllowedError')
    setTimeout(() => resolveChoice({ outcome, platform: 'web' }), choiceDelayMs)
  })
  return Object.assign(event, { prompt, userChoice })
}

function matchMedia(standalone: boolean) {
  return vi.fn((query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
  })) as unknown as typeof window.matchMedia
}

describe('createInstallPrompt', () => {
  let target: EventTarget

  beforeEach(() => {
    target = new EventTarget()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  const client = () => createInstallPrompt({ target, matchMedia: matchMedia(false) })

  it('waits 10 s for appinstalled after an accepted choice', () => {
    expect(INSTALL_WAIT_MS).toBe(10_000)
  })

  it('has no offer until the browser makes one (AC-02)', () => {
    expect(client().hasOffer()).toBe(false)
  })

  it('keeps the offer, stops the browser banner and reports the change (AC-01, AC-02)', () => {
    const install = client()
    const onChange = vi.fn()
    install.onOfferChange(onChange)
    const event = offerEvent()
    target.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(install.hasOffer()).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('drops the offer and reports it when the app gets installed elsewhere (AC-02)', () => {
    const install = client()
    const onChange = vi.fn()
    install.onOfferChange(onChange)
    target.dispatchEvent(offerEvent())
    target.dispatchEvent(new Event('appinstalled'))

    expect(install.hasOffer()).toBe(false)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('reports dismissed and drops the offer (AC-03)', async () => {
    const install = client()
    const event = offerEvent('dismissed')
    target.dispatchEvent(event)

    const result = install.prompt()
    await vi.runAllTimersAsync()

    expect(await result).toEqual({ ok: true, value: 'dismissed' })
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(install.hasOffer()).toBe(false)
  })

  it('reports accepted once appinstalled arrives (AC-01)', async () => {
    const install = client()
    target.dispatchEvent(offerEvent('accepted'))

    const result = install.prompt()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2_000)
    target.dispatchEvent(new Event('appinstalled'))

    expect(await result).toEqual({ ok: true, value: 'accepted' })
    expect(install.hasOffer()).toBe(false)
  })

  it('counts appinstalled that arrives before the choice resolves (AC-01)', async () => {
    const install = client()
    target.dispatchEvent(offerEvent('accepted', 500))

    const result = install.prompt()
    await vi.advanceTimersByTimeAsync(100)
    target.dispatchEvent(new Event('appinstalled'))
    await vi.advanceTimersByTimeAsync(500)

    expect(await result).toEqual({ ok: true, value: 'accepted' })
  })

  it('fails with INSTALL_FAILED when accepted but nothing installs within the wait (AC-03)', async () => {
    const install = createInstallPrompt({
      target,
      matchMedia: matchMedia(false),
      installWaitMs: 300,
    })
    target.dispatchEvent(offerEvent('accepted'))

    const result = install.prompt()
    await vi.advanceTimersByTimeAsync(299)
    let settled = false
    void result.then(() => (settled = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(await result).toEqual({ ok: false, error: { code: 'INSTALL_FAILED' } })
    expect(install.hasOffer()).toBe(false)
  })

  it('fails with INSTALL_FAILED when prompt() rejects, and drops the offer (AC-03)', async () => {
    const install = client()
    target.dispatchEvent(offerEvent('reject'))

    expect(await install.prompt()).toEqual({ ok: false, error: { code: 'INSTALL_FAILED' } })
    expect(install.hasOffer()).toBe(false)
  })

  it('fails with INSTALL_FAILED without an offer', async () => {
    expect(await client().prompt()).toEqual({ ok: false, error: { code: 'INSTALL_FAILED' } })
  })

  it('fails a second prompt while one is in flight without asking the browser again', async () => {
    const install = client()
    const event = offerEvent('dismissed', 1_000)
    target.dispatchEvent(event)

    const first = install.prompt()
    expect(await install.prompt()).toEqual({ ok: false, error: { code: 'INSTALL_FAILED' } })
    expect(event.prompt).toHaveBeenCalledTimes(1)
    await vi.runAllTimersAsync()
    expect(await first).toEqual({ ok: true, value: 'dismissed' })
  })

  it('reports the dropped offer as soon as the browser confirmation opens (AC-03)', async () => {
    const install = client()
    const changes = vi.fn()
    install.onOfferChange(changes)
    target.dispatchEvent(offerEvent('dismissed', 1_000))
    changes.mockClear()

    const first = install.prompt()
    expect(install.hasOffer()).toBe(false)
    expect(changes).toHaveBeenCalledTimes(1)
    await vi.runAllTimersAsync()
    await first
  })

  it('reports standalone display mode (AC-04)', () => {
    expect(createInstallPrompt({ target, matchMedia: matchMedia(true) }).isStandalone()).toBe(true)
    expect(client().isStandalone()).toBe(false)
  })

  it('still reports offers faithfully in standalone mode (the store ignores them, AC-04)', () => {
    const install = createInstallPrompt({ target, matchMedia: matchMedia(true) })
    target.dispatchEvent(offerEvent())
    expect(install.hasOffer()).toBe(true)
  })
})
