import type { CropHandle, ProportionKind } from '@/core'

/** The one catalog of user-facing copy for the "Crop and rotate" tool (screens.md §Message catalog). */

export function infoNoImage(): string {
  return 'Open an image first to crop or rotate it.'
}

/** "Crop and rotate" or C while another tool is open (adjust AC-18). */
export function infoOtherToolOpen(): string {
  return 'Apply or cancel the open tool first.'
}

export const ACTION_LABEL = 'Crop and rotate'
export const ACTION_TOOLTIP = 'Crop and rotate (C)'

export const LABELS = {
  rotateAndFlip: 'Rotate and flip',
  size: 'Size',
  rotateLeft: 'Rotate left',
  rotateRight: 'Rotate right',
  flipHorizontal: 'Flip horizontal',
  flipVertical: 'Flip vertical',
  straighten: 'Straighten',
  proportion: 'Proportion',
  orientation: 'Orientation',
  landscape: 'Landscape',
  portrait: 'Portrait',
  width: 'Width',
  height: 'Height',
  frame: 'Crop frame',
  reset: 'Reset',
  cancel: 'Cancel',
  apply: 'Apply',
} as const

export const PROPORTION_LABELS: Record<ProportionKind, string> = {
  free: 'Free',
  original: 'Original',
  '1:1': '1:1',
  '4:3': '4:3',
  '3:2': '3:2',
  '16:9': '16:9',
}

export const HANDLE_LABELS: Record<CropHandle, string> = {
  n: 'Top edge',
  e: 'Right edge',
  s: 'Bottom edge',
  w: 'Left edge',
  nw: 'Top-left corner',
  ne: 'Top-right corner',
  se: 'Bottom-right corner',
  sw: 'Bottom-left corner',
}
