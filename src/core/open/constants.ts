/** The largest image the editor opens, as declared width × height (AC-09, sad.md §8). */
export const SIZE_CEILING_PIXELS = 100_000_000

/** The Original's long side never exceeds this (AC-05, CONTEXT.md "Downscale limit"). */
export const DOWNSCALE_LIMIT = 4096

/** No intermediate canvas in the worker's reduction exceeds this per side (sad.md §8). */
export const MAX_INTERMEDIATE_SIDE = 16384
