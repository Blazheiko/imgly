import { describe, expect, it } from 'vitest'
import { sniffImageHeader } from './index'
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

function expectResult(input: Uint8Array) {
  const result = sniffImageHeader(input)
  expect(typeof result.ok).toBe('boolean')
}

describe('sniffImageHeader — property/fuzz (ADR 0002 hardening)', () => {
  it.each(SAMPLES)('%s: every truncation returns a Result', (_name, sample) => {
    for (let n = 0; n <= sample.length; n++) expectResult(sample.subarray(0, n))
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
})
