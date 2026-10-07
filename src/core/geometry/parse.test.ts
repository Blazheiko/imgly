import { describe, expect, it } from 'vitest'
import { parseAngle, parseCropSize, parseDecimal } from './index'

describe('parseDecimal (AC-07, AC-10: plain decimal notation only)', () => {
  it.each([
    ['12', 12],
    ['-3,46', -3.46],
    ['+2.04', 2.04],
    ['  7.5  ', 7.5],
    ['.5', 0.5],
    ['5.', 5],
    ['999999999999999999999', 1e21],
  ])('reads %j as a number', (text, value) => {
    expect(parseDecimal(text)).toBe(value)
  })

  it.each([
    '',
    '   ',
    'abc',
    '1e2',
    '1E2',
    '0x10',
    '1.2.3',
    '1,2,3',
    '--1',
    '1-',
    'Infinity',
    '.',
    '+',
  ])('reads %j as not a number', (text) => {
    expect(parseDecimal(text)).toBeNull()
  })
})

describe('parseAngle (AC-07)', () => {
  it('reads degrees into tenths, rounded to the nearest 0.1°', () => {
    expect(parseAngle('-3,46', 0)).toBe(-35)
    expect(parseAngle('+2.04', 0)).toBe(20)
    expect(parseAngle('0.05', 0)).toBe(1)
    expect(parseAngle('-0', 7)).toBe(0)
    expect(Object.is(parseAngle('-0.01', 7), -0)).toBe(false)
  })

  it('snaps a value outside −45…45 to the nearest bound', () => {
    expect(parseAngle('99', 0)).toBe(450)
    expect(parseAngle('-45.04', 0)).toBe(-450)
    expect(parseAngle('999999999999999999999', 0)).toBe(450)
  })

  it('returns to the previous angle for empty or non-numeric text', () => {
    expect(parseAngle('', 123)).toBe(123)
    expect(parseAngle('1e2', 123)).toBe(123)
    expect(parseAngle('abc', -5)).toBe(-5)
  })
})

describe('parseCropSize (AC-10)', () => {
  it('rounds a fraction to the nearest whole number', () => {
    expect(parseCropSize('12.5', 7)).toBe(13)
    expect(parseCropSize('12,4', 7)).toBe(12)
  })

  it('makes zero or a negative value 1', () => {
    expect(parseCropSize('0', 7)).toBe(1)
    expect(parseCropSize('-3', 7)).toBe(1)
    expect(parseCropSize('0.4', 7)).toBe(1)
  })

  it('returns to the previous value for empty or non-numeric text', () => {
    expect(parseCropSize('', 7)).toBe(7)
    expect(parseCropSize('1e2', 7)).toBe(7)
    expect(parseCropSize('px', 7)).toBe(7)
  })

  it('keeps a very long number as a number (the size limit comes later)', () => {
    expect(parseCropSize('999999999999999999999', 7)).toBeGreaterThan(1e20)
  })
})
