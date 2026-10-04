import { describe, expect, it } from 'vitest'
import { HEADER_WINDOW_BYTES, sniffImageHeader } from './index'
import {
  exifApp1,
  gif,
  heif,
  jpeg,
  png,
  webpExtended,
  webpLossless,
  webpLossy,
} from './test-fixtures'

/** Deterministic PRNG so a failing mutation is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SAMPLES: [string, Uint8Array][] = [
  ['jpeg', jpeg({ width: 6000, height: 4000, before: [exifApp1(6)] })],
  ['png', png({ width: 100, height: 50, animated: true })],
  ['gif', gif({ width: 100, height: 50, frames: 3 })],
  ['webp-vp8', webpLossy(640, 480)],
  ['webp-vp8l', webpLossless(640, 480)],
  ['webp-vp8x', webpExtended(640, 480, true)],
  [
    'avif',
    heif({
      major: 'avif',
      compatible: ['mif1'],
      sizes: [
        [640, 480],
        [64, 48],
      ],
    }),
  ],
  ['heic', heif({ major: 'heic', compatible: ['mif1'], sizes: [[4032, 3024]] })],
]

const MUTATIONS_PER_SAMPLE = 3000
const TIME_BUDGET_MS = 2000
/** One full 1 MiB window of the worst content for a format must still parse this fast. */
const WORST_CASE_BUDGET_MS = 250

const FORMATS = new Set(['jpeg', 'png', 'gif', 'webp', 'avif', 'heic'])
const REFUSED = new Set(['SVG', 'BMP', 'ICO', 'TIFF or camera RAW', 'Camera RAW', 'PSD', 'HEIC'])
const MAX_DECLARED_SIDE = 2 ** 32 - 1

/**
 * The parser's contract on any input: it never writes to the bytes, never throws, and returns
 * either a well-formed header or one of the three refusals that judge content.
 */
function expectResult(input: Uint8Array, result = sniffImageHeader(input), before?: Uint8Array) {
  if (before) expect(sameBytes(input, before)).toBe(true)
  if (result.ok) {
    const h = result.value
    expect(FORMATS.has(h.format)).toBe(true)
    for (const side of [h.width, h.height]) {
      expect(Number.isInteger(side) && side > 0 && side <= MAX_DECLARED_SIDE).toBe(true)
    }
    expect(typeof h.animated).toBe('boolean')
    expect([1, 2, 3, 4, 5, 6, 7, 8]).toContain(h.exifOrientation)
    return
  }
  const { code, details } = result.error
  expect(['NOT_AN_IMAGE', 'UNREADABLE', 'UNSUPPORTED_FORMAT']).toContain(code)
  if (code === 'UNSUPPORTED_FORMAT') expect(REFUSED.has(details?.format as string)).toBe(true)
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}

/** Repeats `unit` after `head` until the header window is full. */
function fillWindow(head: Uint8Array, unit: Uint8Array): Uint8Array {
  const out = new Uint8Array(HEADER_WINDOW_BYTES)
  out.set(head)
  for (let o = head.length; o < out.length; o += unit.length) {
    out.set(unit.subarray(0, Math.min(unit.length, out.length - o)), o)
  }
  return out
}

const u8 = (...bytes: number[]) => Uint8Array.from(bytes)
const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0))

const WORST_CASES: [string, Uint8Array][] = [
  // Every JPEG marker is a tiny APP segment, so the walk hits its marker cap.
  ['jpeg: 1 MiB of empty APP segments', fillWindow(u8(0xff, 0xd8), u8(0xff, 0xe1, 0x00, 0x02))],
  // Every PNG chunk is empty, so the walk hits its chunk cap (and CRC-checks each).
  [
    'png: 1 MiB of empty chunks',
    fillWindow(
      u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      u8(0, 0, 0, 0, ...latin1('tEXt'), 0, 0, 0, 0),
    ),
  ],
  // A GIF of one-byte extension sub-blocks that never terminate.
  [
    'gif: 1 MiB of one-byte sub-blocks',
    fillWindow(latin1('GIF89a\x01\x00\x01\x00\x00\x00\x00!\xf9'), u8(1, 0)),
  ],
  // An SVG sniff with no '<svg' anywhere.
  ['text: 1 MiB of almost-SVG', fillWindow(latin1('<?xml version="1.0"?>'), latin1('<sv '))],
  // ISOBMFF: ftyp then a wall of tiny boxes.
  [
    'heif: 1 MiB of empty boxes',
    fillWindow(
      u8(0, 0, 0, 16, ...latin1('ftypheic'), 0, 0, 0, 0),
      u8(0, 0, 0, 8, ...latin1('free')),
    ),
  ],
]

describe('sniffImageHeader — property/fuzz (ADR 0002 hardening)', () => {
  it.each(SAMPLES)('%s: every truncation returns a Result', (_name, sample) => {
    for (let n = 0; n <= sample.length; n++) {
      const input = sample.subarray(0, n)
      const before = input.slice()
      expectResult(input, sniffImageHeader(input), before)
    }
  })

  it.each(SAMPLES)('%s: zeroing any 4-byte run returns a well-formed Result', (_name, sample) => {
    // Hits every size field with 0, which random flips rarely do: a zero side is UNREADABLE.
    for (let o = 0; o < sample.length; o++) {
      const zeroed = sample.slice()
      zeroed.fill(0, o, o + 4)
      expectResult(zeroed)
    }
  })

  it.each(SAMPLES)(
    '%s: random byte mutations return a Result within the time budget',
    (name, sample) => {
      const random = mulberry32(name.length * 7919 + sample.length)
      const started = performance.now()
      for (let i = 0; i < MUTATIONS_PER_SAMPLE; i++) {
        const mutated = sample.slice(0, 1 + Math.floor(random() * sample.length))
        const flips = 1 + Math.floor(random() * 4)
        for (let f = 0; f < flips; f++) {
          mutated[Math.floor(random() * mutated.length)] = Math.floor(random() * 256)
        }
        expectResult(mutated)
      }
      expect(performance.now() - started).toBeLessThan(TIME_BUDGET_MS)
    },
  )

  it.each(WORST_CASES)('%s: parses within the worst-case budget', (_name, input) => {
    const before = input.slice()
    sniffImageHeader(input) // warm up the JIT so the budget measures the walk, not compilation
    const started = performance.now()
    const result = sniffImageHeader(input)
    const elapsed = performance.now() - started
    expectResult(input, result, before)
    expect(elapsed).toBeLessThan(WORST_CASE_BUDGET_MS)
  })
})
