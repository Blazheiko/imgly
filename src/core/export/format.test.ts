import { describe, expect, it } from 'vitest'
import type { ImageFormat } from '../image-header'
import { defaultFormat } from './index'

const confirmed = { png: true, jpeg: true, webp: true }

describe('defaultFormat (AC-19)', () => {
  it('uses the Source format when it is exportable and confirmed', () => {
    expect(defaultFormat('jpeg', confirmed)).toBe('jpeg')
    expect(defaultFormat('webp', confirmed)).toBe('webp')
    expect(defaultFormat('png', confirmed)).toBe('png')
  })

  it.each<ImageFormat>(['heic', 'avif', 'gif'])('falls back to PNG for %s', (format) => {
    expect(defaultFormat(format, confirmed)).toBe('png')
  })

  it('falls back to PNG while the check is pending or has refused the format', () => {
    expect(defaultFormat('webp', { png: true, jpeg: true, webp: false })).toBe('png')
    expect(defaultFormat('webp', { png: true })).toBe('png')
    expect(defaultFormat('jpeg', {})).toBe('png')
  })

  it('falls back to PNG when the Source format is unknown', () => {
    expect(defaultFormat(null, confirmed)).toBe('png')
  })
})
