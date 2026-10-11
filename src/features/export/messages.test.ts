import { describe, expect, it } from 'vitest'
import { appError } from '@/core'
import {
  failureMessage,
  hintChecking,
  hintTransparency,
  hintUnavailable,
  infoDownloaded,
  infoNoImage,
  infoToolOpen,
  infoSaved,
  lineDownloads,
  lineFileReady,
  lineSaveDialog,
} from './messages'

describe('export messages (screens.md §Message catalog)', () => {
  it('words the info notices', () => {
    expect(infoSaved('IMG_4021-edited.jpg')).toBe('Saved IMG_4021-edited.jpg.')
    expect(infoDownloaded('a-edited.png')).toBe("a-edited.png is in your browser's downloads.")
    expect(infoNoImage()).toBe('Open an image first to export it.')
    expect(infoToolOpen('crop-rotate')).toBe('Apply or cancel the crop first, then export.')
    expect(infoToolOpen('adjust')).toBe('Apply or cancel the adjustments first, then export.')
    expect(infoToolOpen('draw')).toBe('Apply or cancel the drawing first, then export.')
  })

  it('words every export failure', () => {
    expect(failureMessage(appError('EXPORT_FAILED'))).toBe(
      'The export failed. Try again, or choose a smaller size.',
    )
    expect(
      failureMessage(appError('EXPORT_FORMAT_MISMATCH', { asked: 'webp', produced: 'png' })),
    ).toBe(
      "This browser didn't make a real WebP file, so nothing was saved. WebP is turned off for now; PNG is selected.",
    )
    expect(failureMessage(appError('EXPORT_NOT_PERMITTED'))).toBe(
      "The app wasn't allowed to save there. Choose another folder.",
    )
    expect(
      failureMessage(appError('EXPORT_EXTENSION_MISMATCH', { name: 'photo.png', format: 'jpeg' })),
    ).toBe('"photo.png" doesn\'t end in .jpg, so nothing was written. Save again with a .jpg name.')
  })

  it('adds the "may now be empty" suffix after the dialog touched the file (AC-13)', () => {
    expect(failureMessage(appError('EXPORT_NOT_PERMITTED'), { touchedFile: 'mine.jpg' })).toBe(
      'The app wasn\'t allowed to save there. Choose another folder. A file named "mine.jpg" there may now be empty or missing.',
    )
  })

  it('words the hints and lines', () => {
    expect(hintUnavailable('webp')).toBe("WebP isn't available in this browser.")
    expect(hintChecking()).toBe('Checking this browser…')
    expect(hintTransparency()).toBe(
      'JPEG has no transparency: transparent areas become white. PNG or WebP keep them.',
    )
    expect(lineSaveDialog()).toBe("You'll choose where to save it.")
    expect(lineDownloads()).toBe("It goes to your browser's downloads.")
    expect(lineFileReady()).toBe('Your file is ready.')
  })
})
