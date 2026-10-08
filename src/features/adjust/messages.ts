import type { AdjustmentKey } from '@/core'

/** The one catalog of user-facing copy for the "Adjust" tool (screens.md §Message catalog). */

/** "Adjust" or A with no image open (AC-19). */
export function infoNoImage(): string {
  return 'Open an image first to adjust it.'
}

/** "Adjust" or A while another tool, such as Crop and rotate, is open (AC-18). */
export function infoOtherToolOpen(): string {
  return 'Apply or cancel the open tool first.'
}

/** The inline hint after Auto found nothing to measure (AC-13). */
export function hintNothingToCorrect(): string {
  return 'Nothing to correct automatically.'
}

export const ACTION_LABEL = 'Adjust'
export const ACTION_TOOLTIP = 'Adjust (A)'
export const BEFORE_LABEL = 'Before'
export const COMPARE_TOOLTIP = 'Hold to see the photo before adjusting (\\)'
export const SLIDER_TOOLTIP = 'Double-click to reset'

export const GROUPS = {
  light: 'Light',
  colour: 'Colour',
  effects: 'Effects',
} as const

export const SLIDER_LABELS: Readonly<Record<AdjustmentKey, string>> = {
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  temperature: 'Temperature',
  tint: 'Tint',
  grayscale: 'Grayscale',
  sepia: 'Sepia',
}

export const BUTTONS = {
  compare: 'Compare',
  auto: 'Auto',
  reset: 'Reset',
  cancel: 'Cancel',
  apply: 'Apply',
} as const
