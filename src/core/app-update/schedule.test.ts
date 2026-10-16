import { describe, expect, it } from 'vitest'
import { UPDATE_CHECK_INTERVAL_MS, msUntilNextCheck, nextCheckDue } from './index'

const MIN = 60 * 1000
const T0 = 1_700_000_000_000

describe('update check schedule (AC-15)', () => {
  it('checks once every 60 minutes', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(60 * MIN)
  })

  it('is due at start when the window is visible', () => {
    expect(nextCheckDue(null, T0, true)).toBe(true)
  })

  it('is not due at start while the window is hidden', () => {
    expect(nextCheckDue(null, T0, false)).toBe(false)
  })

  it('is not due at 59:59 and due at 60:00', () => {
    expect(nextCheckDue(T0, T0 + 60 * MIN - 1000, true)).toBe(false)
    expect(nextCheckDue(T0, T0 + 60 * MIN, true)).toBe(true)
  })

  it('is never due while hidden, however long ago the last check was', () => {
    expect(nextCheckDue(T0, T0 + 120 * MIN, false)).toBe(false)
  })

  it('is due at once on becoming visible after 2 h hidden', () => {
    expect(nextCheckDue(T0, T0 + 120 * MIN, true)).toBe(true)
  })

  it('is not due on becoming visible 10 minutes after a check', () => {
    expect(nextCheckDue(T0, T0 + 10 * MIN, true)).toBe(false)
  })

  it('is not due when the clock moved backwards', () => {
    expect(nextCheckDue(T0, T0 - 5 * MIN, true)).toBe(false)
  })

  describe('msUntilNextCheck', () => {
    it('is 0 at start', () => {
      expect(msUntilNextCheck(null, T0)).toBe(0)
    })

    it('is the time left until 60 minutes after the last check', () => {
      expect(msUntilNextCheck(T0, T0 + 10 * MIN)).toBe(50 * MIN)
    })

    it('is 0 once the interval has passed', () => {
      expect(msUntilNextCheck(T0, T0 + 90 * MIN)).toBe(0)
    })

    it('waits the full time left after the last check when the clock moved backwards', () => {
      expect(msUntilNextCheck(T0, T0 - 5 * MIN)).toBe(65 * MIN)
    })
  })
})
