import { describe, expect, it } from 'vitest'
import { isScriptLoadFailure } from './worker-load'

describe('isScriptLoadFailure (pwa-install-update AC-14)', () => {
  it('reads a plain error Event as a script that failed to load', () => {
    expect(isScriptLoadFailure(new Event('error'))).toBe(true)
  })

  it('reads an ErrorEvent as a runtime error in a loaded worker', () => {
    expect(isScriptLoadFailure(new ErrorEvent('error', { message: 'boom' }))).toBe(false)
  })
})
