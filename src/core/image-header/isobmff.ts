import { appError, err, ok, type AppError, type Result } from '../result'
import { ascii, matches, u32 } from './reader'
import type { ImageHeader } from './types'

const MAX_BOXES_PER_LEVEL = 1024
const MAX_BRANDS = 64
const HEIC_BRANDS = new Set(['heic', 'heix', 'mif1', 'msf1'])

interface Box {
  type: string
  /** Offset of the payload, after the (large)size and type. */
  start: number
  end: number
}

type Brand = { format: 'avif'; animated: boolean } | { format: 'heic'; animated: false }

/** AVIF or HEIC/HEIF by `ftyp` brand; `undefined` for any other ISOBMFF file (or none). */
export function isobmffBrand(b: Uint8Array): Brand | undefined {
  if (!matches(b, 4, 'ftyp')) return undefined
  const size = u32(b, 0)
  if (size === undefined || size < 16) return undefined
  const end = Math.min(size, b.length, 16 + MAX_BRANDS * 4)

  const brands = new Set<string>()
  const major = ascii(b, 8, 4)
  if (major) brands.add(major)
  for (let o = 16; o + 4 <= end; o += 4) brands.add(ascii(b, o, 4)!)

  if (brands.has('avis')) return { format: 'avif', animated: true }
  if (brands.has('avif')) return { format: 'avif', animated: false }
  for (const brand of brands) if (HEIC_BRANDS.has(brand)) return { format: 'heic', animated: false }
  return undefined
}

/** Size from the largest `ispe` in `meta › iprp › ipco` — thumbnails and grid tiles are smaller. */
export function parseIsobmff(b: Uint8Array, brand: Brand): Result<ImageHeader, AppError> {
  const unreadable = err(appError('UNREADABLE'))
  const meta = findChild(b, 0, b.length, 'meta')
  if (!meta) return unreadable
  const iprp = findChild(b, meta.start + 4, meta.end, 'iprp') // meta is a FullBox
  if (!iprp) return unreadable
  const ipco = findChild(b, iprp.start, iprp.end, 'ipco')
  if (!ipco) return unreadable

  const boxes = children(b, ipco.start, ipco.end)
  if (!boxes) return unreadable
  let best: { width: number; height: number } | undefined
  for (const box of boxes) {
    if (box.type !== 'ispe') continue
    const width = u32(b, box.start + 4)
    const height = u32(b, box.start + 8)
    if (width === undefined || height === undefined || box.start + 12 > box.end) return unreadable
    if (!best || width * height > best.width * best.height) best = { width, height }
  }
  if (!best) return unreadable
  return ok({ format: brand.format, ...best, animated: brand.animated, exifOrientation: 1 })
}

/** The first `type` box directly inside [start, end); boxes after it are never inspected. */
function findChild(b: Uint8Array, start: number, end: number, type: string): Box | undefined {
  let found: Box | undefined
  walk(b, start, end, (box) => {
    if (box.type !== type) return true
    found = box
    return false
  })
  return found
}

/** Every box directly inside [start, end), or `undefined` when any of them is malformed. */
function children(b: Uint8Array, start: number, end: number): Box[] | undefined {
  const boxes: Box[] = []
  return walk(b, start, end, (box) => boxes.push(box) > 0) ? boxes : undefined
}

/**
 * Visits the boxes directly inside [start, end) until `visit` returns false. Returns false when a
 * box is malformed before that: smaller than its header, past the end, a 64-bit size beyond the
 * window, or more boxes than the cap.
 */
function walk(b: Uint8Array, start: number, end: number, visit: (box: Box) => boolean): boolean {
  let o = start
  for (let count = 0; o < end; count++) {
    if (count >= MAX_BOXES_PER_LEVEL) return false
    const size32 = u32(b, o)
    const type = ascii(b, o + 4, 4)
    if (size32 === undefined || type === undefined) return false

    let header = 8
    let size = size32
    if (size32 === 0) {
      size = end - o
    } else if (size32 === 1) {
      const high = u32(b, o + 8)
      const low = u32(b, o + 12)
      if (high === undefined || low === undefined || high !== 0) return false
      header = 16
      size = low
    }
    if (size < header || o + size > end) return false
    if (!visit({ type, start: o + header, end: o + size })) return true
    o += size
  }
  return true
}
