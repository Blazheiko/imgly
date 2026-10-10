import { describe, expect, it, vi } from 'vitest'
import { createOpenShortcut, createToolKeys, type OpenShortcutActions } from './shortcuts'

type State = Record<
  'hasWork' | 'exporting' | 'panelOpen' | 'toolOpen' | 'otherToolOpen' | 'confirming',
  boolean
>

function setup(state: Partial<State> = {}) {
  const actions: OpenShortcutActions = {
    hasWork: () => state.hasWork ?? true,
    exporting: () => state.exporting ?? false,
    panelOpen: () => state.panelOpen ?? false,
    toolOpen: () => state.toolOpen ?? false,
    otherToolOpen: () => state.otherToolOpen ?? false,
    confirming: () => state.confirming ?? false,
    open: vi.fn(),
    notifyNoImage: vi.fn(),
    notifyOtherToolOpen: vi.fn(),
  }
  return { actions, handle: createOpenShortcut(actions) }
}

const key = (init: KeyboardEventInit & { target?: EventTarget } = {}) => {
  const event = new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', cancelable: true, ...init })
  if (init.target) Object.defineProperty(event, 'target', { value: init.target })
  return event
}

describe('the D shortcut (screens.md §Keyboard, AC-14, AC-16, AC-17, AC-19)', () => {
  it('opens the tool with d or D, and on a layout that types no Latin letter there', () => {
    const { actions, handle } = setup()
    handle(key())
    handle(key({ key: 'D', shiftKey: true }))
    handle(key({ key: 'в' })) // a Cyrillic layout types в on the D key
    expect(actions.open).toHaveBeenCalledTimes(3)
  })

  it('keeps a Latin layout’s own letter on that key, and other keys', () => {
    const { actions, handle } = setup()
    handle(key({ key: 's' })) // e.g. a layout that types s on the KeyD position
    handle(key({ key: 'a', code: 'KeyA' }))
    expect(actions.open).not.toHaveBeenCalled()
  })

  it('opens once for a held key and leaves Ctrl, Cmd and Alt combinations alone', () => {
    const { actions, handle } = setup()
    handle(key())
    handle(key({ repeat: true }))
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) handle(key({ [mod]: true }))
    expect(actions.open).toHaveBeenCalledTimes(1)
  })

  it('shows the "open an image first" hint with no Work (AC-17)', () => {
    const { actions, handle } = setup({ hasWork: false })
    handle(key())
    expect(actions.notifyNoImage).toHaveBeenCalledTimes(1)
    expect(actions.open).not.toHaveBeenCalled()
  })

  it('says to apply or cancel the open tool first while another tool is open (AC-16)', () => {
    const { actions, handle } = setup({ otherToolOpen: true })
    handle(key())
    expect(actions.notifyOtherToolOpen).toHaveBeenCalledTimes(1)
    expect(actions.open).not.toHaveBeenCalled()
  })

  it.each([
    ['an export is running (AC-14)', { exporting: true }],
    ['the export panel is open', { panelOpen: true }],
    ['the tool is already open (AC-19)', { toolOpen: true }],
    ['the replace dialog is open', { confirming: true }],
  ])('does nothing while %s', (_why, state) => {
    const { actions, handle } = setup(state)
    const event = key()
    handle(event)
    expect(actions.open).not.toHaveBeenCalled()
    expect(actions.notifyNoImage).not.toHaveBeenCalled()
    expect(actions.notifyOtherToolOpen).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('types d in a text field, also with another tool open', () => {
    const { actions, handle } = setup({ otherToolOpen: true })
    handle(key({ target: document.createElement('input') }))
    handle(key({ target: document.createElement('textarea') }))
    expect(actions.notifyOtherToolOpen).not.toHaveBeenCalled()
    expect(actions.open).not.toHaveBeenCalled()
  })
})

describe('in-tool keys (screens.md §Keyboard, AC-06, AC-18, AC-19)', () => {
  function tool(blocked = false) {
    const actions = {
      blocked: () => blocked,
      apply: vi.fn(),
      cancel: vi.fn(),
      setMode: vi.fn(),
      stepWidth: vi.fn(),
    }
    return { actions, handle: createToolKeys(actions) }
  }
  const press = (init: KeyboardEventInit & { target?: EventTarget }) => {
    const event = new KeyboardEvent('keydown', { cancelable: true, ...init })
    if (init.target) Object.defineProperty(event, 'target', { value: init.target })
    return event
  }

  it('B and E select the Brush and the Eraser, letter first, else the key position', () => {
    const { actions, handle } = tool()
    handle(press({ key: 'b', code: 'KeyB' }))
    handle(press({ key: 'E', code: 'KeyE', shiftKey: true }))
    handle(press({ key: 'и', code: 'KeyB' }))
    handle(press({ key: 'у', code: 'KeyE' }))
    expect(actions.setMode.mock.calls).toEqual([['brush'], ['eraser'], ['brush'], ['eraser']])
  })

  it('[ and ] step the width by 1, by 10 with Shift (Shift+[ types {), and repeat while held', () => {
    const { actions, handle } = tool()
    handle(press({ key: '[', code: 'BracketLeft' }))
    handle(press({ key: ']', code: 'BracketRight' }))
    handle(press({ key: '{', code: 'BracketLeft', shiftKey: true }))
    handle(press({ key: '}', code: 'BracketRight', shiftKey: true, repeat: true }))
    expect(actions.stepWidth.mock.calls).toEqual([[-1], [1], [-10], [10]])
  })

  it('takes the key position on a layout that types another character there (German ü, +)', () => {
    const { actions, handle } = tool()
    handle(press({ key: 'ü', code: 'BracketLeft' }))
    handle(press({ key: '+', code: 'BracketRight' }))
    expect(actions.stepWidth.mock.calls).toEqual([[-1], [1]])
  })

  it('types B, E, [ and ] normally in a text field', () => {
    const { actions, handle } = tool()
    const field = document.createElement('input')
    for (const key of ['b', 'e', '[', ']']) handle(press({ key, target: field }))
    expect(actions.setMode).not.toHaveBeenCalled()
    expect(actions.stepWidth).not.toHaveBeenCalled()
  })

  it('Escape cancels from anywhere, a field included', () => {
    const { actions, handle } = tool()
    const event = press({ key: 'Escape', target: document.createElement('input') })
    handle(event)
    expect(actions.cancel).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('Enter applies, except on a button (it presses it) or in a field (it commits the width)', () => {
    const { actions, handle } = tool()
    handle(press({ key: 'Enter', target: document.createElement('button') }))
    handle(press({ key: 'Enter', target: document.createElement('input') }))
    expect(actions.apply).not.toHaveBeenCalled()
    handle(press({ key: 'Enter', target: document.body }))
    expect(actions.apply).toHaveBeenCalledTimes(1)
  })

  it('Enter on the focused Custom colour input opens its picker and does not apply', () => {
    const { actions, handle } = tool()
    const picker = Object.assign(document.createElement('input'), { type: 'color' })
    const event = press({ key: 'Enter', target: picker })
    handle(event)
    expect(actions.apply).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('leaves Ctrl, Cmd and Alt combinations alone, and everything while blocked', () => {
    const { actions, handle } = tool()
    handle(press({ key: 'b', code: 'KeyB', ctrlKey: true }))
    handle(press({ key: '[', code: 'BracketLeft', metaKey: true }))
    const blocked = tool(true)
    blocked.handle(press({ key: 'Escape' }))
    blocked.handle(press({ key: 'e', code: 'KeyE' }))
    expect(actions.setMode).not.toHaveBeenCalled()
    expect(actions.stepWidth).not.toHaveBeenCalled()
    expect(blocked.actions.cancel).not.toHaveBeenCalled()
    expect(blocked.actions.setMode).not.toHaveBeenCalled()
  })
})
