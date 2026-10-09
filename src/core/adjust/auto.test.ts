import { describe, expect, it } from 'vitest'
import { int, mulberry32 } from '../geometry/test-helpers'
import { autoAdjust, type ImageSample } from './index'

type Px = [number, number, number, number]

function sample(pixels: Px[], width = pixels.length): ImageSample {
  return { width, height: pixels.length / width, data: new Uint8Array(pixels.flat()) }
}

/** `n` opaque pixels whose colour `colour(i)` gives for i in 0…n−1. */
function opaque(n: number, colour: (i: number) => [number, number, number]): Px[] {
  return Array.from({ length: n }, (_, i) => [...colour(i), 255] as Px)
}

const ramp = (from: number, to: number) => (i: number, n: number) =>
  Math.round(from + ((to - from) * i) / (n - 1))

function greyRamp(from: number, to: number, n = 256): Px[] {
  const at = ramp(from, to)
  return opaque(n, (i) => {
    const v = at(i, n)
    return [v, v, v]
  })
}

function values(s: ImageSample) {
  const result = autoAdjust(s)
  if (result.kind !== 'values') throw new Error(`expected values, got ${result.kind}`)
  return result.values
}

describe('autoAdjust directions (AC-12)', () => {
  it('lightens a dark image and darkens a bright one', () => {
    expect(values(sample(greyRamp(0, 90))).brightness).toBeGreaterThan(0)
    expect(values(sample(greyRamp(170, 255))).brightness).toBeLessThan(0)
  })

  it('raises the contrast of a flat image and leaves one already spanning 5…250 near 0', () => {
    expect(values(sample(greyRamp(100, 156))).contrast).toBeGreaterThan(0)
    const spanning = values(sample(greyRamp(5, 250)))
    expect(Math.abs(spanning.brightness)).toBeLessThanOrEqual(2)
    expect(Math.abs(spanning.contrast)).toBeLessThanOrEqual(1)
  })

  it('pulls an image clipped at 0 and 255 slightly in, towards 5 and 250 (ADR-0004)', () => {
    expect(values(sample(greyRamp(0, 255))).contrast).toBeLessThan(0)
  })

  it('warms a blue cast and cools a yellow one', () => {
    const at = ramp(40, 200)
    const blue = sample(opaque(256, (i) => [at(i, 256) * 0.8, at(i, 256), at(i, 256)]))
    const yellow = sample(opaque(256, (i) => [at(i, 256), at(i, 256), at(i, 256) * 0.8]))
    expect(values(blue).temperature).toBeGreaterThan(0)
    expect(values(yellow).temperature).toBeLessThan(0)
  })

  it('turns a green cast magenta and a magenta cast green', () => {
    const at = ramp(40, 200)
    const green = sample(opaque(256, (i) => [at(i, 256) * 0.85, at(i, 256), at(i, 256) * 0.85]))
    const magenta = sample(opaque(256, (i) => [at(i, 256), at(i, 256) * 0.85, at(i, 256)]))
    expect(values(green).tint).toBeGreaterThan(0)
    expect(values(magenta).tint).toBeLessThan(0)
  })

  it('leaves temperature and tint near 0 on a grey image with a few colour pixels', () => {
    const pixels = [...greyRamp(30, 220, 1000), ...opaque(10, () => [255, 0, 0])]
    const v = values(sample(pixels))
    expect(Math.abs(v.temperature)).toBeLessThanOrEqual(5)
    expect(Math.abs(v.tint)).toBeLessThanOrEqual(5)
  })

  it('returns only brightness, contrast, temperature and tint', () => {
    expect(Object.keys(values(sample(greyRamp(0, 90)))).sort()).toEqual([
      'brightness',
      'contrast',
      'temperature',
      'tint',
    ])
  })
  it('takes tint from the clamped temperature, so a strong red cast still turns green (R1)', () => {
    // Means R≈0.90, G≈0.40, B≈0.10: temperature clamps at −50, and after that gain the red–blue
    // average (0.81 + 0.11) / 2 = 0.46 still sits above green, so green must rise (tint < 0).
    const at = ramp(-10, 10)
    const cast = sample(opaque(256, (i) => [230 + at(i, 256), 102 + at(i, 256), 26 + at(i, 256)]))
    const v = values(cast)
    expect(v.temperature).toBe(-50)
    expect(v.tint).toBe(-50)
  })
})

describe('autoAdjust bounds and determinism (AC-13)', () => {
  it('clamps a very dark image at brightness +50', () => {
    expect(values(sample(greyRamp(0, 6))).brightness).toBe(50)
  })

  it('gives whole numbers within ±50 for any sample (seeded)', () => {
    const rand = mulberry32(1301)
    for (let run = 0; run < 200; run++) {
      const n = int(rand, 2, 300)
      const pixels: Px[] = Array.from({ length: n }, () => {
        const a = int(rand, 0, 255)
        return [int(rand, 0, a), int(rand, 0, a), int(rand, 0, a), a]
      })
      const result = autoAdjust(sample(pixels))
      if (result.kind === 'nothing') continue
      for (const v of Object.values(result.values)) {
        expect(Number.isInteger(v)).toBe(true)
        expect(Object.is(v, -0)).toBe(false)
        expect(v).toBeGreaterThanOrEqual(-50)
        expect(v).toBeLessThanOrEqual(50)
      }
    }
  })

  it('gives the same values for the same sample', () => {
    const rand = mulberry32(1302)
    const pixels = opaque(500, () => [int(rand, 0, 255), int(rand, 0, 255), int(rand, 0, 255)])
    expect(autoAdjust(sample(pixels))).toEqual(autoAdjust(sample(pixels)))
  })
})

describe('autoAdjust with nothing to measure (AC-13)', () => {
  it('returns nothing for an empty sample', () => {
    expect(autoAdjust({ width: 0, height: 0, data: new Uint8Array(0) })).toEqual({
      kind: 'nothing',
    })
  })

  it('returns nothing when every pixel is fully transparent', () => {
    expect(
      autoAdjust(
        sample([
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ]),
      ),
    ).toEqual({ kind: 'nothing' })
  })

  it('returns nothing for one colour, and ignores fully transparent pixels around it', () => {
    const one = opaque(64, () => [200, 120, 40])
    expect(autoAdjust(sample(one))).toEqual({ kind: 'nothing' })
    const withHoles: Px[] = [...one, [0, 0, 0, 0], [0, 0, 0, 0]]
    expect(autoAdjust(sample(withHoles))).toEqual({ kind: 'nothing' })
  })
  it('returns nothing for one colour with anti-aliased edges (R2)', () => {
    // 8-bit premultiplied storage rounds c × a / 255, so unpremultiplying an edge pixel does not
    // give back exactly c; it must still count as the same colour.
    const [r, g, b] = [200, 30, 30]
    const edge = (a: number): Px => [
      Math.round((r * a) / 255),
      Math.round((g * a) / 255),
      Math.round((b * a) / 255),
      a,
    ]
    const pixels: Px[] = [...opaque(60, () => [r, g, b]), edge(64), edge(128), edge(192), edge(1)]
    expect(autoAdjust(sample(pixels))).toEqual({ kind: 'nothing' })
  })

  it.each([
    ['rounds down', Math.floor],
    ['rounds up', Math.ceil],
  ])('returns nothing for one colour whose engine %s the edges at every alpha (N1)', (_, store) => {
    // Engines store semi-transparent colours at different premultiplied steps (ADR-0005), so an
    // edge may sit one level off the nearest step and must still count as the same colour.
    const [r, g, b] = [200, 30, 30]
    for (let a = 1; a < 255; a++) {
      const edge: Px = [store((r * a) / 255), store((g * a) / 255), store((b * a) / 255), a]
      const pixels: Px[] = [...opaque(60, () => [r, g, b]), edge]
      expect(autoAdjust(sample(pixels)), `alpha ${a}`).toEqual({ kind: 'nothing' })
    }
  })

  it('still measures a soft edge two levels off its colour', () => {
    const edge: Px = [Math.round((200 * 192) / 255) - 2, 23, 23, 192]
    expect(autoAdjust(sample([...opaque(60, () => [200, 30, 30]), edge])).kind).toBe('values')
  })

  it('still measures two colours that differ by one level on opaque pixels', () => {
    const pixels: Px[] = [...opaque(32, () => [200, 30, 30]), ...opaque(32, () => [201, 30, 30])]
    expect(autoAdjust(sample(pixels)).kind).toBe('values')
  })
})

describe('autoAdjust on transparency (AC-12)', () => {
  it('counts a partly transparent pixel at its real colour', () => {
    // Multiples of 5 at alpha 51 premultiply exactly: c × 51 / 255 = c / 5.
    const at = ramp(20, 200)
    const colours = Array.from({ length: 100 }, (_, i) => {
      const v = Math.round(at(i, 100) / 5) * 5
      return [v, Math.min(255, v + 25), Math.max(0, v - 15)] as [number, number, number]
    })
    const solid = colours.map(([r, g, b]) => [r, g, b, 255] as Px)
    const soft = colours.map(([r, g, b], i) =>
      i % 2 === 0 ? ([r, g, b, 255] as Px) : ([r / 5, g / 5, b / 5, 51] as Px),
    )
    expect(autoAdjust(sample(soft))).toEqual(autoAdjust(sample(solid)))
  })
})
