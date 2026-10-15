import { describe, expect, it } from 'vitest'
import { appError, err, isAppErrorCode, ok, type AppErrorCode, type Result } from './result'

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

describe('AppErrorCode', () => {
  it('carries every open-and-view code', () => {
    const codes: AppErrorCode[] = [
      'FILE_NOT_PERMITTED',
      'NOT_AN_IMAGE',
      'UNREADABLE',
      'DECODE_FAILED',
      'UNSUPPORTED_FORMAT',
      'TOO_LARGE',
      'UNSUPPORTED_BROWSER',
      'DISPLAY_LOST',
    ]

    expect(codes.map((code) => appError(code).code)).toEqual(codes)
  })

  it('carries the gallery storage codes', () => {
    const codes: AppErrorCode[] = ['STORAGE_UNAVAILABLE', 'STORAGE_FAILED', 'WORK_DAMAGED']

    expect(codes.map((code) => appError(code).code)).toEqual(codes)
    for (const code of codes) expect(isAppErrorCode(code)).toBe(true)
  })

  it('carries the pwa-install-update code INSTALL_FAILED (AC-03)', () => {
    expect(appError('INSTALL_FAILED').code).toBe('INSTALL_FAILED')
    expect(isAppErrorCode('INSTALL_FAILED')).toBe(true)
  })

  it('keeps STORAGE_QUOTA and rejects unknown codes', () => {
    expect(isAppErrorCode('STORAGE_QUOTA')).toBe(true)
    expect(isAppErrorCode('STORAGE_NOPE')).toBe(false)
  })

  it('carries details on a WORK_DAMAGED error', () => {
    expect(err(appError('WORK_DAMAGED', { id: 'w1' }))).toEqual({
      ok: false,
      error: { code: 'WORK_DAMAGED', details: { id: 'w1' } },
    })
  })
})
