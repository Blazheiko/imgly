import type { Geometry, Size } from './types'

/** Field by field, never by the pixels the Geometries produce (AC-13). */
export function geometryEquals(a: Geometry, b: Geometry): boolean {
  return (
    a.flipH === b.flipH &&
    a.flipV === b.flipV &&
    a.rotation === b.rotation &&
    a.straighten === b.straighten &&
    a.crop.x === b.crop.x &&
    a.crop.y === b.crop.y &&
    a.crop.width === b.crop.width &&
    a.crop.height === b.crop.height
  )
}

/** The Work's size: its Crop's width and height. Nothing else reads the Work's size. */
export function workSize(work: { geometry: Geometry }): Size {
  return { width: work.geometry.crop.width, height: work.geometry.crop.height }
}
