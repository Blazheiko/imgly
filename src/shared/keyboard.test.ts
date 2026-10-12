import { describe, expect, it } from 'vitest'
import { isTextTarget } from './keyboard'

const input = (type: string) => {
  const el = document.createElement('input')
  el.type = type
  return el
}

describe('isTextTarget (undo-redo AC-08, AC-14)', () => {
  it.each(['text', 'number', 'search', 'email'])('is true for an <input type="%s">', (type) => {
    expect(isTextTarget(input(type))).toBe(true)
  })

  it('is true for a textarea and a select', () => {
    expect(isTextTarget(document.createElement('textarea'))).toBe(true)
    expect(isTextTarget(document.createElement('select'))).toBe(true)
  })

  it('is true for a contenteditable element', () => {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    document.body.appendChild(el)
    expect(isTextTarget(el)).toBe(true)
    el.remove()
  })

  it.each(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color'])(
    'is false for an <input type="%s">',
    (type) => {
      expect(isTextTarget(input(type))).toBe(false)
    },
  )

  it('is false for a button, a plain element, the window and null', () => {
    expect(isTextTarget(document.createElement('button'))).toBe(false)
    expect(isTextTarget(document.createElement('div'))).toBe(false)
    expect(isTextTarget(window)).toBe(false)
    expect(isTextTarget(null)).toBe(false)
  })
})
