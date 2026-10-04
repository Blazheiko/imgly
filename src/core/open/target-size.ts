import type { Size } from '../view'
import { DOWNSCALE_LIMIT, MAX_INTERMEDIATE_SIDE } from './constants'

/**
 * The Original's size for an upright image: the long side reduced to the Downscale limit with
 * proportions kept, the short side rounded and never below 1 px (AC-05); unchanged otherwise (AC-06).
 */
export function targetSize(width: number, height: number): Size & { downscaled: boolean } {
  const scale = DOWNSCALE_LIMIT / Math.max(width, height)
  if (scale >= 1) return { width, height, downscaled: false }
  return { ...scaled({ width, height }, scale), downscaled: true }
}

/**
 * The sizes the worker draws into, in order (feature ADR 0001): a first step that fits within
 * 16 384 px per side if needed, halving while more than twice the target, then exactly the target.
 */
export function reductionSteps(source: Size, target: Size): Size[] {
  if (source.width === target.width && source.height === target.height) return []
  const steps: Size[] = []
  let current = source
  const overCap = MAX_INTERMEDIATE_SIDE / Math.max(current.width, current.height)
  if (overCap < 1) {
    current = scaled(current, overCap)
    steps.push(current)
  }
  const targetLong = Math.max(target.width, target.height)
  while (Math.max(current.width, current.height) > 2 * targetLong) {
    current = scaled(current, 0.5)
    steps.push(current)
  }
  steps.push({ width: target.width, height: target.height })
  return steps
}

function scaled(size: Size, scale: number): Size {
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  }
}
