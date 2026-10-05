import type { AppError, AppErrorCode, Size } from '@/core'
import { DOWNSCALE_LIMIT, SIZE_CEILING_PIXELS } from '@/core'

/**
 * The one catalog of user-facing copy for opening an image (screens.md §Message catalog). Every
 * AppError code maps to exactly one message; no file name or raw browser text is ever shown.
 */

export function infoDownscaled(source: Size, original: Size): string {
  return `Reduced to the ${DOWNSCALE_LIMIT} px limit: ${source.width}×${source.height} → ${original.width}×${original.height}.`
}

export function infoFirstFrame(): string {
  return 'Animated image: only the first frame was kept.'
}

export function infoOthersIgnored(count: number): string {
  const others = count === 1 ? '1 other file was ignored.' : `${count} other files were ignored.`
  return `The editor works with one image at a time. ${others}`
}

export function failureNoImageFiles(): string {
  return 'Only image files can be opened.'
}

/** Copy for the blocking screens that replace the canvas area (SCR-04, SCR-05). */
export const BLOCKING = {
  UNSUPPORTED_BROWSER: {
    title: "This browser can't display the editor.",
    body: "The editor needs WebGL2 graphics, which this browser doesn't support or has turned off. Try a current version of Chrome, Edge, Firefox or Safari.",
  },
  DISPLAY_LOST: {
    title: "The display couldn't recover.",
    body: "Your graphics were interrupted and the editor couldn't restore them. Reload the page to continue. The open image and any edits will be lost.",
  },
} as const

const NOT_READ = "This file couldn't be read as an image."

const FAILURES: Record<AppErrorCode, (details: Record<string, unknown>) => string> = {
  STORAGE_QUOTA: () => "This browser's storage for the editor is full.",
  FILE_NOT_PERMITTED: () =>
    "The app wasn't allowed to read this file. Make it available on this computer first, for example by downloading it from your cloud drive.",
  NOT_AN_IMAGE: () => NOT_READ,
  UNREADABLE: () => NOT_READ,
  DECODE_FAILED: () => NOT_READ,
  UNSUPPORTED_FORMAT: ({ format }) =>
    format === 'HEIC'
      ? "HEIC files can't be opened in this browser. Convert it to JPEG or PNG, or use a browser that opens HEIC."
      : `${typeof format === 'string' ? format : 'These'} files can't be opened here. Convert it to JPEG or PNG.`,
  TOO_LARGE: ({ width, height, megapixels, ceilingMegapixels, megabytes, ceilingMegabytes }) => {
    if (megabytes !== undefined) {
      return `This file is too large: ${megabytes} MB. The largest file the editor opens is ${ceilingMegabytes} MB.`
    }
    const ceiling = `The largest the editor opens is ${ceilingMegapixels ?? SIZE_CEILING_PIXELS / 1e6} MP.`
    if (width === undefined || height === undefined || megapixels === undefined) {
      return `This image is too large. ${ceiling}`
    }
    return `This image is too large: ${width}×${height} px (${megapixels} MP). ${ceiling}`
  },
  UNSUPPORTED_BROWSER: () => BLOCKING.UNSUPPORTED_BROWSER.title,
  DISPLAY_LOST: () => BLOCKING.DISPLAY_LOST.title,
}

export function failureMessage(error: AppError): string {
  return FAILURES[error.code](error.details ?? {})
}
