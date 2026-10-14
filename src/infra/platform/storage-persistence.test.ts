import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPersisted, requestPersistence } from './storage-persistence'

function stubStorage(storage: unknown) {
  vi.stubGlobal('navigator', { ...navigator, storage })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestPersistence', () => {
  it('AC-14: asks the browser once and passes a granted answer through', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persist })
    expect(await requestPersistence()).toBe(true)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('AC-14: passes a declined answer through', async () => {
    stubStorage({ persist: vi.fn(async () => false) })
    expect(await requestPersistence()).toBe(false)
  })

  it('AC-14: returns false when navigator.storage is missing', async () => {
    stubStorage(undefined)
    expect(await requestPersistence()).toBe(false)
  })

  it('AC-14: returns false when persist is missing', async () => {
    stubStorage({})
    expect(await requestPersistence()).toBe(false)
  })

  it('AC-14: returns false when persist rejects', async () => {
    stubStorage({
      persist: vi.fn(async () => {
        throw new DOMException('no', 'SecurityError')
      }),
    })
    expect(await requestPersistence()).toBe(false)
  })
})

describe('isPersisted', () => {
  it('AC-13: reports the browser current answer each time it is read', async () => {
    const persisted = vi.fn<() => Promise<boolean>>()
    persisted.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    stubStorage({ persisted })
    expect(await isPersisted()).toBe(true)
    expect(await isPersisted()).toBe(false)
    expect(persisted).toHaveBeenCalledTimes(2)
  })

  it('AC-13: returns undefined when navigator.storage is missing', async () => {
    stubStorage(undefined)
    expect(await isPersisted()).toBeUndefined()
  })

  it('AC-13: returns undefined when persisted rejects', async () => {
    stubStorage({
      persisted: vi.fn(async () => {
        throw new DOMException('no', 'SecurityError')
      }),
    })
    expect(await isPersisted()).toBeUndefined()
  })
})
