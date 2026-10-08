import { describe, expect, it, vi } from 'vitest'
import { createOpenShortcut, type OpenShortcutActions } from './shortcuts'

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
  const event = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', cancelable: true, ...init })
  if (init.target) Object.defineProperty(event, 'target', { value: init.target })
  return event
}

describe('the A shortcut (screens.md §Keyboard, AC-15, AC-18, AC-19, AC-21)', () => {
  it('opens the tool with a or A, and on a layout that types no Latin letter there', () => {
    const { actions, handle } = setup()
    handle(key())
    handle(key({ key: 'A', shiftKey: true }))
    handle(key({ key: 'ф' }))
    expect(actions.open).toHaveBeenCalledTimes(3)
  })

  it('keeps a Latin layout’s own letter on that key, and other keys', () => {
    const { actions, handle } = setup()
    handle(key({ key: 'q' })) // AZERTY types q on the KeyA position
    handle(key({ key: 'b', code: 'KeyB' }))
    expect(actions.open).not.toHaveBeenCalled()
  })

  it('opens once for a held key', () => {
    const { actions, handle } = setup()
    handle(key())
    handle(key({ repeat: true }))
    expect(actions.open).toHaveBeenCalledTimes(1)
  })

  it('leaves Ctrl, Cmd and Alt combinations alone', () => {
    const { actions, handle } = setup()
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) handle(key({ [mod]: true }))
    expect(actions.open).not.toHaveBeenCalled()
  })

  it('shows the "open an image first" hint with no Work (AC-19)', () => {
    const { actions, handle } = setup({ hasWork: false })
    handle(key())
    expect(actions.notifyNoImage).toHaveBeenCalledTimes(1)
    expect(actions.open).not.toHaveBeenCalled()
  })

  it('says to apply or cancel the open tool first while Crop and rotate is open (AC-18)', () => {
    const { actions, handle } = setup({ otherToolOpen: true })
    handle(key())
    expect(actions.notifyOtherToolOpen).toHaveBeenCalledTimes(1)
    expect(actions.open).not.toHaveBeenCalled()
  })

  it.each([
    ['an export is running (AC-15)', { exporting: true }],
    ['the export panel is open', { panelOpen: true }],
    ['the tool is already open (AC-21)', { toolOpen: true }],
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

  it('does nothing while a text field has focus, with or without another tool open', () => {
    const editable = document.createElement('div')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    for (const state of [{}, { otherToolOpen: true }, { hasWork: false }]) {
      const { actions, handle } = setup(state)
      for (const target of [
        document.createElement('input'),
        document.createElement('textarea'),
        editable,
      ]) {
        handle(key({ target }))
      }
      expect(actions.open).not.toHaveBeenCalled()
      expect(actions.notifyNoImage).not.toHaveBeenCalled()
      expect(actions.notifyOtherToolOpen).not.toHaveBeenCalled()
    }
  })

  it('still opens from a slider or a button, which take no typed text', () => {
    const range = Object.assign(document.createElement('input'), { type: 'range' })
    const { actions, handle } = setup()
    handle(key({ target: range }))
    handle(key({ target: document.createElement('button') }))
    expect(actions.open).toHaveBeenCalledTimes(2)
  })
})
