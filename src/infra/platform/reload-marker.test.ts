import { describe, expect, it } from 'vitest'
import { REOPEN_KEY, markReopen, takeReopen } from './reload-marker'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  }
}

function blockedStorage(): Storage {
  const fail = () => {
    throw new DOMException('blocked', 'SecurityError')
  }
  return {
    length: 0,
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  }
}

describe('reload marker (ADR-0003, AC-08)', () => {
  it('stores only the Work id under the one fixed key', () => {
    const storage = memoryStorage()
    markReopen('0190-work', storage)

    expect(storage.length).toBe(1)
    expect(storage.getItem(REOPEN_KEY)).toBe('0190-work')
  })

  it('takes the id once: the second take returns null', () => {
    const storage = memoryStorage()
    markReopen('0190-work', storage)

    expect(takeReopen(storage)).toBe('0190-work')
    expect(storage.getItem(REOPEN_KEY)).toBeNull()
    expect(takeReopen(storage)).toBeNull()
  })

  it('returns null when nothing was marked', () => {
    expect(takeReopen(memoryStorage())).toBeNull()
  })

  it('removes an empty value and returns null', () => {
    const storage = memoryStorage()
    storage.setItem(REOPEN_KEY, '')
    expect(takeReopen(storage)).toBeNull()
    expect(storage.getItem(REOPEN_KEY)).toBeNull()
  })

  it('does nothing and opens no Work when storage is blocked', () => {
    const storage = blockedStorage()
    expect(() => markReopen('0190-work', storage)).not.toThrow()
    expect(takeReopen(storage)).toBeNull()
  })

  it("defaults to this tab's sessionStorage", () => {
    sessionStorage.clear()
    markReopen('0190-work')
    expect(sessionStorage.getItem(REOPEN_KEY)).toBe('0190-work')
    expect(takeReopen()).toBe('0190-work')
    expect(sessionStorage.getItem(REOPEN_KEY)).toBeNull()
  })
})
