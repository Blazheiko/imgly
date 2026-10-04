import { describe, expect, it } from 'vitest'
import { newId } from './ids'

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('returns a UUIDv7 string', () => {
    expect(newId()).toMatch(UUID_V7)
  })

  it('is unique and time-sortable', () => {
    const ids = Array.from({ length: 50 }, () => newId())

    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(ids)
  })
})
