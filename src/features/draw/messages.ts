import { PALETTE } from '@/core'

/** The one catalog of user-facing copy for the "Draw" tool (screens.md §Message catalog). */

/** "Draw" or D with no image open (AC-17). */
export function infoNoImage(): string {
  return 'Open an image first to draw on it.'
}

/** "Draw" or D while another tool is open (AC-16). */
export function infoOtherToolOpen(): string {
  return 'Apply or cancel the open tool first.'
}

export const ACTION_LABEL = 'Draw'
export const ACTION_TOOLTIP = 'Draw (D)'

export const GROUPS = {
  mode: 'Mode',
  colour: 'Colour',
  width: 'Width',
} as const

export const MODES = {
  brush: { label: 'Brush', tooltip: 'Brush (B)' },
  eraser: { label: 'Eraser', tooltip: 'Eraser (E)' },
} as const

/** The palette swatches' accessible names and tooltips, in AC-02 order. */
export const SWATCH_NAMES: readonly string[] = PALETTE.map((c) => c.name)

export const CUSTOM_COLOUR = 'Custom colour'
export const WIDTH_LABEL = 'Width'
export const WIDTH_TOOLTIP = 'Width ([ and ], Shift for 10)'

export const BUTTONS = {
  clear: 'Clear',
  cancel: 'Cancel',
  apply: 'Apply',
} as const
