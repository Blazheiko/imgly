import type { CropRect, Geometry, Rotation, Size } from './types'

/** Deterministic PRNG so a failing property case is reproducible from its seed. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const ROTATIONS: Rotation[] = [0, 90, 180, 270]

export const int = (rand: () => number, min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1))

export function randomOriginal(rand: () => number): Size {
  return { width: int(rand, 1, 400), height: int(rand, 1, 400) }
}

/** A random integer Crop inside a `width`×`height` frame (no Straighten angle). */
export function randomCrop(rand: () => number, width: number, height: number): CropRect {
  const x = int(rand, 0, width - 1)
  const y = int(rand, 0, height - 1)
  return { x, y, width: int(rand, 1, width - x), height: int(rand, 1, height - y) }
}

/** A random Geometry with no Straighten angle, so its Crop is plain turned-image pixels. */
export function randomGeometry(rand: () => number, original: Size): Geometry {
  const rotation = ROTATIONS[int(rand, 0, 3)] as Rotation
  const quarter = rotation === 90 || rotation === 270
  const w = quarter ? original.height : original.width
  const h = quarter ? original.width : original.height
  return {
    flipH: rand() < 0.5,
    flipV: rand() < 0.5,
    rotation,
    straighten: 0,
    crop: randomCrop(rand, w, h),
  }
}
