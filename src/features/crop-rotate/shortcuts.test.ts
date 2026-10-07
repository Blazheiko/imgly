import { describe, expect, it, vi } from 'vitest'
import { createOpenShortcut, type OpenShortcutActions } from './shortcuts'

function setup(
  state: Partial<Record<'hasWork' | 'exporting' | 'panelOpen' | 'toolOpen', boolean>> = {},
) {
  const actions: OpenShortcutActions = {
    hasWork: () => state.hasWork ?? true,
    exporting: () => state.exporting ?? false,
    panelOpen: () => state.panelOpen ?? false,
    toolOpen: () => state.toolOpen ?? false,
    open: vi.fn(),
    notifyNoImage: vi.fn(),
  }
  return { actions, handle: createOpenShortcut(actions) }
}

const key = (init: KeyboardEventInit & { target?: EventTarget } = {}) => {
  const event = new KeyboardEvent('keydown', { key: 'c', cancelable: true, ...init })
  if (init.target) Object.defineProperty(event, 'target', { value: init.target })
  return event
}

describe('the C shortcut (AC-18, AC-20)', () => {
  it('opens the tool with c or C', () => {
    const { actions, handle } = setup()
    handle(key())
    handle(key({ key: 'C', shiftKey: true }))
    expect(actions.open).toHaveBeenCalledTimes(2)
  })

  it('shows the "open an image first" hint with no Work', () => {
    const { actions, handle } = setup({ hasWork: false })
    handle(key())
    expect(actions.notifyNoImage).toHaveBeenCalledTimes(1)
    expect(actions.open).not.toHaveBeenCalled()
  })

  it.each([
    ['an export is running (AC-15)', { exporting: true }],
    ['the export panel is open', { panelOpen: true }],
    ['the tool is already open', { toolOpen: true }],
  ])('does nothing while %s', (_why, state) => {
    const { actions, handle } = setup(state)
    const event = key()
    handle(event)
    expect(actions.open).not.toHaveBeenCalled()
    expect(actions.notifyNoImage).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('does nothing while a text field has focus', () => {
    const editable = document.createElement('div')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    for (const target of [
      document.createElement('input'),
      document.createElement('textarea'),
      editable,
    ]) {
      const { actions, handle } = setup()
      handle(key({ target }))
      expect(actions.open).not.toHaveBeenCalled()
    }
  })

  it('ignores c with Ctrl, Cmd or Alt, and other keys', () => {
    const { actions, handle } = setup()
    handle(key({ ctrlKey: true }))
    handle(key({ metaKey: true }))
    handle(key({ altKey: true }))
    handle(key({ key: 'x' }))
    expect(actions.open).not.toHaveBeenCalled()
  })
})
