import { describe, expect, it } from 'vitest'
import { appError, type AppErrorCode } from '@/core'
import {
  BLOCKING,
  failureMessage,
  failureNoImageFiles,
  infoDownscaled,
  infoFirstFrame,
  infoOthersIgnored,
} from './messages'

describe('message catalog (screens.md §Message catalog)', () => {
  it('info: downscaled (AC-05)', () => {
    expect(infoDownscaled({ width: 6000, height: 4000 }, { width: 4096, height: 2731 })).toBe(
      'Reduced to the 4096 px limit: 6000×4000 → 4096×2731.',
    )
  })

  it('info: first frame only (AC-11)', () => {
    expect(infoFirstFrame()).toBe('Animated image: only the first frame was kept.')
  })

  it('info: other files ignored, plural and singular (AC-03)', () => {
    expect(infoOthersIgnored(2)).toBe(
      'The editor works with one image at a time. 2 other files were ignored.',
    )
    expect(infoOthersIgnored(1)).toBe(
      'The editor works with one image at a time. 1 other file was ignored.',
    )
  })

  it('failure: no image files dropped (AC-04)', () => {
    expect(failureNoImageFiles()).toBe('Only image files can be opened.')
  })

  it.each([
    ['SVG', "SVG files can't be opened here. Convert it to JPEG or PNG."],
    ['PSD', "PSD files can't be opened here. Convert it to JPEG or PNG."],
    ['Camera RAW', "Camera RAW files can't be opened here. Convert it to JPEG or PNG."],
    [
      'TIFF or camera RAW',
      "TIFF or camera RAW files can't be opened here. Convert it to JPEG or PNG.",
    ],
  ])('failure: UNSUPPORTED_FORMAT %s (AC-07)', (format, copy) => {
    expect(failureMessage(appError('UNSUPPORTED_FORMAT', { format }))).toBe(copy)
  })

  it('failure: UNSUPPORTED_FORMAT HEIC has its own copy (AC-07)', () => {
    expect(failureMessage(appError('UNSUPPORTED_FORMAT', { format: 'HEIC' }))).toBe(
      "HEIC files can't be opened in this browser. Convert it to JPEG or PNG, or use a browser that opens HEIC.",
    )
  })

  it.each(['NOT_AN_IMAGE', 'UNREADABLE', 'DECODE_FAILED'] as const)(
    'failure: %s shares the AC-08 copy',
    (code) => {
      expect(failureMessage(appError(code))).toBe("This file couldn't be read as an image.")
    },
  )

  it('failure: TOO_LARGE with both sizes (AC-09)', () => {
    expect(
      failureMessage(
        appError('TOO_LARGE', {
          width: 20000,
          height: 12000,
          megapixels: 240,
          ceilingMegapixels: 100,
        }),
      ),
    ).toBe(
      'This image is too large: 20000×12000 px (240 MP). The largest the editor opens is 100 MP.',
    )
  })

  it('failure: TOO_LARGE by file size (AC-09)', () => {
    expect(failureMessage(appError('TOO_LARGE', { megabytes: 612, ceilingMegabytes: 500 }))).toBe(
      'This file is too large: 612 MB. The largest file the editor opens is 500 MB.',
    )
  })

  it('failure: FILE_NOT_PERMITTED (AC-10)', () => {
    expect(failureMessage(appError('FILE_NOT_PERMITTED'))).toBe(
      "The app wasn't allowed to read this file. Make it available on this computer first, for example by downloading it from your cloud drive.",
    )
  })

  it('blocking copy for SCR-04 and SCR-05', () => {
    expect(BLOCKING.UNSUPPORTED_BROWSER).toEqual({
      title: "This browser can't display the editor.",
      body: "The editor needs WebGL2 graphics, which this browser doesn't support or has turned off. Try a current version of Chrome, Edge, Firefox or Safari.",
    })
    expect(BLOCKING.DISPLAY_LOST).toEqual({
      title: "The display couldn't recover.",
      body: "Your graphics were interrupted and the editor couldn't restore them. Reload the page to continue. The open image and any edits will be lost.",
    })
  })

  it('maps every AppError code to a plain message', () => {
    const codes: AppErrorCode[] = [
      'STORAGE_QUOTA',
      'FILE_NOT_PERMITTED',
      'NOT_AN_IMAGE',
      'UNREADABLE',
      'DECODE_FAILED',
      'UNSUPPORTED_FORMAT',
      'TOO_LARGE',
      'UNSUPPORTED_BROWSER',
      'DISPLAY_LOST',
    ]
    for (const code of codes) {
      const text = failureMessage(appError(code))
      expect(text.length).toBeGreaterThan(10)
      expect(text).not.toMatch(/undefined|\{|\}/)
    }
  })
})
