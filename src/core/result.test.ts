import { describe, expect, it } from 'vitest'
import { appError, err, ok, type Result } from './result'

describe('Result', () => {
  it('ok wraps a value', () => {
    const result: Result<number> = ok(42)

    expect(result).toEqual({ ok: true, value: 42 })
  })

  it('err wraps an AppError', () => {
    const result: Result<number> = err(appError('STORAGE_QUOTA'))

    expect(result).toEqual({ ok: false, error: { code: 'STORAGE_QUOTA' } })
  })

  it('narrows on the ok flag', () => {
    const result: Result<number> = err(appError('STORAGE_QUOTA', { usedBytes: 10 }))

    if (result.ok) throw new Error('expected an error')
    expect(result.error.code).toBe('STORAGE_QUOTA')
    expect(result.error.details).toEqual({ usedBytes: 10 })
  })
})
