import { describe, expect, it } from 'vitest'
import { int, mulberry32 } from '../geometry/test-helpers'
import {
  ADJUSTMENT_KEYS,
  ADJUSTMENT_RANGES,
  NEUTRAL_ADJUSTMENTS,
  applyAdjustmentsToPixel,
  lightness,
  toUniforms,
  type Adjustments,
} from './index'

type Rgb = [number, number, number]

/** An opaque pixel through the seven steps, as rounded stored values. */
function opaque(rgb: Rgb, a: Partial<Adjustments>): Rgb {
  const [r, g, b] = applyAdjustmentsToPixel([...rgb, 255], { ...NEUTRAL_ADJUSTMENTS, ...a })
  return [Math.round(r), Math.round(g), Math.round(b)]
}

const GREY: Rgb = [128, 128, 128]
const BLACK: Rgb = [0, 0, 0]
const WHITE: Rgb = [255, 255, 255]

describe('ADR-0003 anchors (each step alone, the rest neutral)', () => {
  it.each([
    [100, 181],
    [50, 157],
    [-50, 96],
    [-100, 64],
  ])('brightness %d: mid-grey → %d, black and white stay', (brightness, grey) => {
    expect(opaque(GREY, { brightness })).toEqual([grey, grey, grey])
    expect(opaque(BLACK, { brightness })).toEqual(BLACK)
    expect(opaque(WHITE, { brightness })).toEqual(WHITE)
  })

  it('brightness +100: 64 → 128', () => {
    expect(opaque([64, 64, 64], { brightness: 100 })).toEqual([128, 128, 128])
  })

  it.each([
    [100, 0, 255],
    [50, 0, 255],
    [-50, 64, 192],
    [-100, 128, 128],
  ])('contrast %d: mid-grey stays, black → %d, white → %d', (contrast, black, white) => {
    expect(opaque(GREY, { contrast })).toEqual(GREY)
    expect(opaque(BLACK, { contrast })).toEqual([black, black, black])
    expect(opaque(WHITE, { contrast })).toEqual([white, white, white])
  })

  it('contrast +100: 64 → 0; contrast +50: 192 → 230', () => {
    expect(opaque([64, 64, 64], { contrast: 100 })).toEqual([0, 0, 0])
    expect(opaque([192, 192, 192], { contrast: 50 })).toEqual([230, 230, 230])
  })

  it('temperature ±100: mid-grey and white anchors, black not tinted', () => {
    expect(opaque(GREY, { temperature: 100 })).toEqual([154, 128, 102])
    expect(opaque(GREY, { temperature: -100 })).toEqual([102, 128, 154])
    expect(opaque(WHITE, { temperature: 100 })).toEqual([255, 255, 204])
    expect(opaque(WHITE, { temperature: -100 })).toEqual([204, 255, 255])
    expect(opaque(BLACK, { temperature: 100 })).toEqual(BLACK)
    expect(opaque(BLACK, { temperature: -100 })).toEqual(BLACK)
  })

  it('tint ±100: mid-grey and white anchors, black not tinted', () => {
    expect(opaque(GREY, { tint: 100 })).toEqual([128, 102, 128])
    expect(opaque(GREY, { tint: -100 })).toEqual([128, 154, 128])
    expect(opaque(WHITE, { tint: 100 })).toEqual([255, 204, 255])
    expect(opaque(WHITE, { tint: -100 })).toEqual(WHITE)
    expect(opaque(BLACK, { tint: 100 })).toEqual(BLACK)
    expect(opaque(BLACK, { tint: -100 })).toEqual(BLACK)
  })

  it('grayscale 100%: grey, black and white stay; red, green, blue, yellow keep lightness', () => {
    expect(opaque(GREY, { grayscale: 100 })).toEqual(GREY)
    expect(opaque(BLACK, { grayscale: 100 })).toEqual(BLACK)
    expect(opaque(WHITE, { grayscale: 100 })).toEqual(WHITE)
    expect(opaque([255, 0, 0], { grayscale: 100 })).toEqual([54, 54, 54])
    expect(opaque([0, 255, 0], { grayscale: 100 })).toEqual([182, 182, 182])
    expect(opaque([0, 0, 255], { grayscale: 100 })).toEqual([18, 18, 18])
    expect(opaque([255, 255, 0], { grayscale: 100 })).toEqual([237, 237, 237])
  })

  it('sepia 100%: mid-grey, black and white anchors', () => {
    expect(opaque(GREY, { sepia: 100 })).toEqual([173, 154, 120])
    expect(opaque(BLACK, { sepia: 100 })).toEqual(BLACK)
    expect(opaque(WHITE, { sepia: 100 })).toEqual([255, 255, 239])
  })
})

describe('lightness (Rec. 709)', () => {
  it('weights red, green and blue as CSS grayscale()', () => {
    expect(lightness(1, 0, 0)).toBeCloseTo(0.2126, 10)
    expect(lightness(0, 1, 0)).toBeCloseTo(0.7152, 10)
    expect(lightness(0, 0, 1)).toBeCloseTo(0.0722, 10)
    expect(lightness(1, 1, 1)).toBeCloseTo(1, 10)
  })
})

const RUNS = 400

function randomRgb(rand: () => number): Rgb {
  return [int(rand, 0, 255), int(rand, 0, 255), int(rand, 0, 255)]
}

function randomAdjustments(rand: () => number): Adjustments {
  const a = { ...NEUTRAL_ADJUSTMENTS }
  for (const key of ADJUSTMENT_KEYS) {
    const { min, max } = ADJUSTMENT_RANGES[key]
    a[key] = int(rand, min, max)
  }
  return a
}

/** The unrounded channels of an opaque pixel. */
function exact(rgb: Rgb, a: Partial<Adjustments>): Rgb {
  const [r, g, b] = applyAdjustmentsToPixel([...rgb, 255], { ...NEUTRAL_ADJUSTMENTS, ...a })
  return [r, g, b]
}

describe('AC-02 directions (seeded)', () => {
  it('a higher brightness never darkens a channel; a lower one never lightens it', () => {
    const rand = mulberry32(201)
    for (let i = 0; i < RUNS; i++) {
      const c = randomRgb(rand)
      const up = exact(c, { brightness: int(rand, 1, 100) })
      const down = exact(c, { brightness: int(rand, -100, -1) })
      for (let ch = 0; ch < 3; ch++) {
        expect(up[ch]).toBeGreaterThanOrEqual(c[ch]! - 1e-9)
        expect(down[ch]).toBeLessThanOrEqual(c[ch]! + 1e-9)
      }
    }
  })

  it('a higher contrast spreads tones from 128; a lower one moves them towards 128', () => {
    const rand = mulberry32(202)
    for (let i = 0; i < RUNS; i++) {
      const c = randomRgb(rand)
      const up = exact(c, { contrast: int(rand, 1, 100) })
      const down = exact(c, { contrast: int(rand, -100, -1) })
      for (let ch = 0; ch < 3; ch++) {
        const v = c[ch]!
        if (v > 128) expect(up[ch]).toBeGreaterThanOrEqual(v - 1e-9)
        if (v < 128) expect(up[ch]).toBeLessThanOrEqual(v + 1e-9)
        expect(Math.abs(down[ch]! - 128)).toBeLessThanOrEqual(Math.abs(v - 128) + 1e-9)
        expect(Math.sign(Math.round(down[ch]!) - 128) * Math.sign(v - 128)).toBeGreaterThanOrEqual(
          0,
        )
      }
    }
  })

  it('keeps mid-grey 128 at every contrast', () => {
    for (let contrast = -100; contrast <= 100; contrast++) {
      expect(opaque(GREY, { contrast })).toEqual(GREY)
    }
  })
})

describe('AC-03 directions (seeded)', () => {
  const spread = (c: Rgb) => Math.max(...c) - Math.min(...c)

  it('saturation −100 makes every pixel grey; a grey pixel stays at any saturation', () => {
    const rand = mulberry32(301)
    for (let i = 0; i < RUNS; i++) {
      const [r, g, b] = opaque(randomRgb(rand), { saturation: -100 })
      expect(g).toBe(r)
      expect(b).toBe(r)
      const v = int(rand, 0, 255)
      expect(opaque([v, v, v], { saturation: int(rand, -100, 100) })).toEqual([v, v, v])
    }
  })

  it('a higher saturation never makes colours less vivid; a lower one never more', () => {
    const rand = mulberry32(302)
    for (let i = 0; i < RUNS; i++) {
      const c = randomRgb(rand)
      expect(spread(exact(c, { saturation: int(rand, 1, 100) }))).toBeGreaterThanOrEqual(
        spread(c) - 1e-9,
      )
      expect(spread(exact(c, { saturation: int(rand, -100, -1) }))).toBeLessThanOrEqual(
        spread(c) + 1e-9,
      )
    }
  })

  it('on mid-grey, temperature moves red and blue apart and tint moves green', () => {
    for (let t = 1; t <= 100; t++) {
      const warm = exact(GREY, { temperature: t })
      const cool = exact(GREY, { temperature: -t })
      expect(warm[0]).toBeGreaterThan(128)
      expect(warm[2]).toBeLessThan(128)
      expect(cool[0]).toBeLessThan(128)
      expect(cool[2]).toBeGreaterThan(128)
      const magenta = exact(GREY, { tint: t })
      const green = exact(GREY, { tint: -t })
      expect(magenta[1]).toBeLessThan(magenta[0])
      expect(magenta[1]).toBeLessThan(magenta[2])
      expect(green[1]).toBeGreaterThan(green[0])
      expect(green[1]).toBeGreaterThan(green[2])
    }
  })
})

describe('AC-04 grayscale and sepia act last (seeded)', () => {
  it('grayscale 100% with sepia 0% gives equal channels whatever the other values', () => {
    const rand = mulberry32(401)
    for (let i = 0; i < RUNS; i++) {
      const a = { ...randomAdjustments(rand), grayscale: 100, sepia: 0 }
      const [r, g, b] = exact(randomRgb(rand), a)
      expect(g).toBe(r)
      expect(b).toBe(r)
    }
  })

  it('sepia 100% gives red ≥ green ≥ blue whatever the other values, grayscale included', () => {
    const rand = mulberry32(402)
    for (let i = 0; i < RUNS; i++) {
      const a = { ...randomAdjustments(rand), sepia: 100 }
      const [r, g, b] = exact(randomRgb(rand), a)
      expect(r).toBeGreaterThanOrEqual(g)
      expect(g).toBeGreaterThanOrEqual(b)
    }
  })

  it('moves towards the effect in proportion to the amount', () => {
    const rand = mulberry32(403)
    for (let i = 0; i < RUNS; i++) {
      const c = randomRgb(rand)
      const amount = int(rand, 0, 100)
      for (const key of ['grayscale', 'sepia'] as const) {
        const full = exact(c, { [key]: 100 })
        const part = exact(c, { [key]: amount })
        for (let ch = 0; ch < 3; ch++) {
          expect(part[ch]).toBeCloseTo(c[ch]! + (full[ch]! - c[ch]!) * (amount / 100), 6)
        }
      }
    }
  })
})

describe('AC-06 only colours change (seeded)', () => {
  it('neutral Adjustments return the pixel bit for bit', () => {
    const rand = mulberry32(601)
    for (let i = 0; i < RUNS; i++) {
      const alpha = int(rand, 0, 255)
      const px = [rand() * alpha, rand() * alpha, rand() * alpha, alpha] as const
      expect(applyAdjustmentsToPixel(px, NEUTRAL_ADJUSTMENTS)).toEqual([...px])
    }
  })

  it('keeps alpha exactly and leaves a fully transparent pixel at zero', () => {
    const rand = mulberry32(602)
    for (let i = 0; i < RUNS; i++) {
      const alpha = int(rand, 0, 255)
      const a = randomAdjustments(rand)
      const out = applyAdjustmentsToPixel(
        [alpha * rand(), alpha * rand(), alpha * rand(), alpha],
        a,
      )
      expect(out[3]).toBe(alpha)
      if (alpha === 0) expect(out).toEqual([0, 0, 0, 0])
    }
  })

  it('changes a partly transparent pixel exactly as the same opaque pixel (no fringe)', () => {
    const rand = mulberry32(603)
    for (let i = 0; i < RUNS; i++) {
      const c = randomRgb(rand)
      const a = randomAdjustments(rand)
      const solid = exact(c, a)
      for (const alpha of [1, 64, 128, 254]) {
        const k = alpha / 255
        const out = applyAdjustmentsToPixel([c[0] * k, c[1] * k, c[2] * k, alpha], a)
        for (let ch = 0; ch < 3; ch++) expect(out[ch]! / k).toBeCloseTo(solid[ch]!, 6)
      }
    }
  })
})

describe('AC-07 clamped, never wrapped (seeded)', () => {
  it('keeps every channel within 0…255 at any values', () => {
    const rand = mulberry32(702)
    for (let i = 0; i < RUNS; i++) {
      for (const v of exact(randomRgb(rand), randomAdjustments(rand))) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(255)
      }
    }
  })

  it('holds a channel pushed past white at white, not wrapped to black', () => {
    expect(opaque([250, 250, 250], { contrast: 100, brightness: 100 })).toEqual(WHITE)
    expect(opaque([255, 128, 0], { temperature: 100 })).toEqual([255, 128, 0])
  })
})

describe('toUniforms', () => {
  it('turns the colour block off for neutral Adjustments (QG-1b)', () => {
    expect(toUniforms(NEUTRAL_ADJUSTMENTS).enabled).toBe(false)
  })

  it.each(ADJUSTMENT_KEYS)('turns the colour block on when only %s is off neutral', (key) => {
    expect(toUniforms({ ...NEUTRAL_ADJUSTMENTS, [key]: 1 }).enabled).toBe(true)
  })

  it('packs each value pre-scaled for the shader', () => {
    const u = toUniforms({
      brightness: 100,
      contrast: 50,
      saturation: -100,
      temperature: 100,
      tint: -50,
      grayscale: 25,
      sepia: 100,
    })
    expect(u).toEqual({
      enabled: true,
      exponent: 0.5,
      contrast: 1.6,
      saturation: 0,
      temperature: 0.2,
      tint: -0.1,
      grayscale: 0.25,
      sepia: 1,
    })
  })

  it('packs neutral values as the identity of each step', () => {
    expect(toUniforms(NEUTRAL_ADJUSTMENTS)).toEqual({
      enabled: false,
      exponent: 1,
      contrast: 1,
      saturation: 1,
      temperature: 0,
      tint: 0,
      grayscale: 0,
      sepia: 0,
    })
  })
})
