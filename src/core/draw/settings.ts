/** A preset colour of the Draw tool's palette (AC-02). */
export interface PaletteColour {
  name: string
  /** `#RRGGBB`, upper case. */
  hex: string
}

/** The 10 preset colours, in the order the palette shows them (AC-02). */
export const PALETTE: readonly PaletteColour[] = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#E53935' },
  { name: 'Orange', hex: '#FB8C00' },
  { name: 'Yellow', hex: '#FDD835' },
  { name: 'Green', hex: '#43A047' },
  { name: 'Cyan', hex: '#00ACC1' },
  { name: 'Blue', hex: '#1E88E5' },
  { name: 'Purple', hex: '#8E24AA' },
  { name: 'Pink', hex: '#D81B60' },
]

/** The colour the tool opens with the first time in a session (AC-01). */
export const DEFAULT_COLOUR = '#E53935'

/** The width the tool opens with the first time in a session, in image pixels (AC-01). */
export const DEFAULT_WIDTH = 12

/** The width range, in whole image pixels, shared by the Brush and the Eraser (AC-02). */
export const MIN_WIDTH = 1
export const MAX_WIDTH = 200

/** The tool's two modes: the Brush paints, the Eraser removes marks (AC-04). */
export type DrawMode = 'brush' | 'eraser'
