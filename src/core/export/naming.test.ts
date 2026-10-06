import { describe, expect, it } from 'vitest'
import { isAppErrorCode } from '../result'
import {
  EXPORT_EXTENSIONS,
  exportFileName,
  matchesExtension,
  sourceNameOf,
  type ExportFormat,
} from './index'

describe('sourceNameOf (AC-07)', () => {
  it.each([
    ['IMG_4021.HEIC', 'IMG_4021'],
    ['photo.jpg', 'photo'],
    ['photo.JPEG', 'photo'],
    ['a.jpe', 'a'],
    ['a.jfif', 'a'],
    ['a.png', 'a'],
    ['a.WebP', 'a'],
    ['a.avif', 'a'],
    ['a.gif', 'a'],
    ['a.heif', 'a'],
    ['archive.tar.png', 'archive.tar'],
    ['scan.v2', 'scan.v2'],
    ['notes.txt', 'notes.txt'],
    ['noext', 'noext'],
    ['', ''],
    ['.png', ''],
  ])('%j → %j', (fileName, expected) => {
    expect(sourceNameOf(fileName)).toBe(expected)
  })
})

describe('exportFileName (AC-07)', () => {
  it('adds -edited and the main extension per format', () => {
    expect(exportFileName('IMG_4021', 'jpeg')).toBe('IMG_4021-edited.jpg')
    expect(exportFileName('IMG_4021', 'png')).toBe('IMG_4021-edited.png')
    expect(exportFileName('IMG_4021', 'webp')).toBe('IMG_4021-edited.webp')
    expect(exportFileName('scan.v2', 'png')).toBe('scan.v2-edited.png')
  })

  it('step 1: replaces forbidden and control characters with _', () => {
    expect(exportFileName('a<b>c:d"e/f\\g|h?i*j', 'png')).toBe('a_b_c_d_e_f_g_h_i_j-edited.png')
    expect(exportFileName('a\u0000b\u001fc\u007fd\u0085e\u009f', 'png')).toBe(
      'a_b_c_d_e_-edited.png',
    )
    expect(exportFileName('a/b:c', 'png')).toBe('a_b_c-edited.png')
  })

  it('step 2: trims leading and trailing dots and spaces', () => {
    expect(exportFileName(' ..hidden. ', 'png')).toBe('hidden-edited.png')
    expect(exportFileName('.bashrc', 'png')).toBe('bashrc-edited.png')
  })

  it('step 3: cuts to at most 200 UTF-8 bytes without splitting a character', () => {
    const ascii = 'a'.repeat(250)
    expect(exportFileName(ascii, 'png')).toBe(`${'a'.repeat(200)}-edited.png`)

    // 'é' is 2 bytes: 199 ASCII + 'é' = 201 bytes → the 'é' must be dropped, not split.
    const multi = `${'a'.repeat(199)}éé`
    expect(exportFileName(multi, 'png')).toBe(`${'a'.repeat(199)}-edited.png`)

    // A 4-byte emoji (surrogate pair) is never split either.
    const emoji = `${'b'.repeat(198)}😀`
    expect(exportFileName(emoji, 'png')).toBe(`${'b'.repeat(198)}-edited.png`)

    const fits = `${'c'.repeat(196)}😀`
    expect(new TextEncoder().encode(fits).length).toBe(200)
    expect(exportFileName(fits, 'png')).toBe(`${fits}-edited.png`)
  })

  it('step 4: trims dots and spaces again after the cut', () => {
    const name = `${'a'.repeat(198)}. x`
    expect(exportFileName(name, 'png')).toBe(`${'a'.repeat(198)}-edited.png`)
  })

  it.each([
    'CON',
    'con',
    'PRN',
    'AUX',
    'NUL',
    'CONIN$',
    'conout$',
    'COM0',
    'COM9',
    'LPT0',
    'lpt9',
    'COM¹',
    'COM²',
    'COM³',
    'LPT¹',
    'Lpt²',
    'LPT³',
  ])('step 5: %s is a Windows reserved name and gets _ appended', (reserved) => {
    expect(exportFileName(reserved, 'png')).toBe(`${reserved}_-edited.png`)
  })

  it('step 5: applies to the part before the first dot, trailing spaces removed', () => {
    expect(exportFileName('con.backup', 'png')).toBe('con_.backup-edited.png')
    expect(exportFileName('NUL .txt', 'png')).toBe('NUL_ .txt-edited.png')
    expect(exportFileName('Lpt¹', 'jpeg')).toBe('Lpt¹_-edited.jpg')
  })

  it.each(['COM10', 'CONSOLE', 'LPT', 'xcon', 'COM⁴'])('step 5: %s is not reserved', (name) => {
    expect(exportFileName(name, 'png')).toBe(`${name}-edited.png`)
  })

  it.each(['', '_', '___', '. _ .', '...', '   ', '<>|'])(
    'step 6: %j leaves nothing usable → image',
    (name) => {
      expect(exportFileName(name, 'png')).toBe('image-edited.png')
      expect(exportFileName(name, 'jpeg')).toBe('image-edited.jpg')
    },
  )

  it('keeps non-ASCII letters', () => {
    expect(exportFileName('Фото_зима', 'webp')).toBe('Фото_зима-edited.webp')
    expect(exportFileName('写真', 'png')).toBe('写真-edited.png')
  })
})

describe('matchesExtension (AC-01b)', () => {
  it('lists the accepted extensions per format', () => {
    expect(EXPORT_EXTENSIONS).toEqual({
      jpeg: ['.jpg', '.jpeg', '.jpe', '.jfif'],
      png: ['.png'],
      webp: ['.webp'],
    })
  })

  const cases: Array<[string, ExportFormat, boolean]> = [
    ['photo.jpg', 'jpeg', true],
    ['photo.JPG', 'jpeg', true],
    ['photo.JPEG', 'jpeg', true],
    ['photo.Jpe', 'jpeg', true],
    ['photo.jfif', 'jpeg', true],
    ['photo.JFIF', 'jpeg', true],
    ['photo.png', 'png', true],
    ['photo.PnG', 'png', true],
    ['photo.webp', 'webp', true],
    ['photo.WEBP', 'webp', true],
    ['photo', 'jpeg', false],
    ['photo.png', 'jpeg', false],
    ['photo.jpg', 'png', false],
    ['photo.jpg', 'webp', false],
    ['photo.jpg.png', 'jpeg', false],
    ['photo.png.jpg', 'jpeg', true],
    ['jpg', 'jpeg', false],
    ['.jpg', 'jpeg', true],
    ['photo.jpgx', 'jpeg', false],
  ]

  it.each(cases)('%j as %s → %s', (name, format, expected) => {
    expect(matchesExtension(name, format)).toBe(expected)
  })
})

describe('export error codes', () => {
  it.each([
    'EXPORT_FAILED',
    'EXPORT_FORMAT_MISMATCH',
    'EXPORT_NOT_PERMITTED',
    'EXPORT_EXTENSION_MISMATCH',
  ])('%s is an AppErrorCode', (code) => {
    expect(isAppErrorCode(code)).toBe(true)
  })
})
