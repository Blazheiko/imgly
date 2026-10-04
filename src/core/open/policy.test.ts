import { describe, expect, it } from 'vitest'
import type { ImageHeader } from '../image-header'
import {
  checkFileBytes,
  checkOpenPolicy,
  DOWNSCALE_LIMIT,
  MAX_INTERMEDIATE_SIDE,
  looksLikeImageFile,
  reductionSteps,
  SIZE_CEILING_BYTES,
  SIZE_CEILING_PIXELS,
  targetSize,
} from './index'

const header = (width: number, height: number): ImageHeader => ({
  format: 'jpeg',
  width,
  height,
  animated: false,
  exifOrientation: 1,
})

describe('constants', () => {
  it('fixes the ceiling, the Downscale limit and the intermediate cap', () => {
    expect(SIZE_CEILING_PIXELS).toBe(100_000_000)
    expect(DOWNSCALE_LIMIT).toBe(4096)
    expect(MAX_INTERMEDIATE_SIDE).toBe(16384)
  })
})

describe('checkOpenPolicy (AC-09)', () => {
  it('accepts exactly 100 000 000 declared pixels', () => {
    const h = header(10_000, 10_000)
    expect(checkOpenPolicy(h)).toEqual({ ok: true, value: h })
  })

  it('refuses one pixel more, with both sizes in megapixels', () => {
    expect(checkOpenPolicy(header(100_000_001, 1))).toEqual({
      ok: false,
      error: {
        code: 'TOO_LARGE',
        details: { width: 100_000_001, height: 1, megapixels: 100, ceilingMegapixels: 100 },
      },
    })
  })

  it('rounds megapixels to one decimal', () => {
    const result = checkOpenPolicy(header(50_000, 50_000))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.details).toMatchObject({ megapixels: 2500 })

    const odd = checkOpenPolicy(header(12_345, 9_876))
    if (!odd.ok) expect(odd.error.details).toMatchObject({ megapixels: 121.9 })
  })
})

describe('targetSize (AC-05, AC-06)', () => {
  it('maps the AC-05 example 6000×4000 to 4096×2731', () => {
    expect(targetSize(6000, 4000)).toEqual({ width: 4096, height: 2731, downscaled: true })
  })

  it('treats the height as the long side of a portrait image', () => {
    expect(targetSize(3000, 6000)).toEqual({ width: 2048, height: 4096, downscaled: true })
  })

  it('keeps an image whose long side is exactly 4096', () => {
    expect(targetSize(4096, 1000)).toEqual({ width: 4096, height: 1000, downscaled: false })
  })

  it('keeps a small image unchanged', () => {
    expect(targetSize(640, 480)).toEqual({ width: 640, height: 480, downscaled: false })
  })

  it('never lets the short side fall below 1 px', () => {
    expect(targetSize(100_000, 3)).toEqual({ width: 4096, height: 1, downscaled: true })
  })
})

describe('reductionSteps', () => {
  it('is empty when nothing needs reducing', () => {
    expect(reductionSteps({ width: 640, height: 480 }, { width: 640, height: 480 })).toEqual([])
  })

  it('goes in one step when the source is at most twice the target', () => {
    expect(reductionSteps({ width: 6000, height: 4000 }, { width: 4096, height: 2731 })).toEqual([
      { width: 4096, height: 2731 },
    ])
  })

  it('halves while more than twice the target, then lands exactly on it', () => {
    expect(reductionSteps({ width: 12000, height: 8000 }, { width: 4096, height: 2731 })).toEqual([
      { width: 6000, height: 4000 },
      { width: 4096, height: 2731 },
    ])
  })

  it('caps the first step at 16 384 px per side for an elongated image', () => {
    const steps = reductionSteps({ width: 100_000, height: 3 }, { width: 4096, height: 1 })
    expect(steps[0]).toEqual({ width: 16384, height: 1 })
    expect(steps.at(-1)).toEqual({ width: 4096, height: 1 })
    for (const step of steps) {
      expect(step.width).toBeLessThanOrEqual(MAX_INTERMEDIATE_SIDE)
      expect(step.height).toBeLessThanOrEqual(MAX_INTERMEDIATE_SIDE)
      expect(step.height).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('looksLikeImageFile (AC-03, AC-08)', () => {
  it('counts a file as an image by its MIME type or its image extension', () => {
    expect(looksLikeImageFile({ name: 'text-named.png', type: '' })).toBe(true)
    expect(looksLikeImageFile({ name: 'scan', type: 'image/tiff' })).toBe(true)
    expect(looksLikeImageFile({ name: 'IMG_0001.HEIC', type: '' })).toBe(true)
    expect(looksLikeImageFile({ name: 'photo.jpeg', type: 'application/octet-stream' })).toBe(true)
  })

  it('does not count other files', () => {
    expect(looksLikeImageFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false)
    expect(looksLikeImageFile({ name: 'png', type: '' })).toBe(false)
    expect(looksLikeImageFile({ name: 'archive.png.zip', type: 'application/zip' })).toBe(false)
  })
})

describe('checkFileBytes (byte ceiling)', () => {
  it('allows a file at the byte ceiling', () => {
    expect(checkFileBytes(SIZE_CEILING_BYTES)).toEqual({ ok: true, value: SIZE_CEILING_BYTES })
  })

  it('refuses a larger file as TOO_LARGE with its size in MB (AC-09)', () => {
    expect(checkFileBytes(SIZE_CEILING_BYTES + 1)).toEqual({
      ok: false,
      error: { code: 'TOO_LARGE', details: { megabytes: 501, ceilingMegabytes: 500 } },
    })
  })
})
